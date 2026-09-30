import Cocoa
import WebKit

// MATH-helper for Mac. The whole app ships inside the app (Resources/web) and is served to the web view
// through the mh:// scheme, so it works with no internet. History and scores are kept in the web view's local storage.
let webRoot = Bundle.main.resourceURL!.appendingPathComponent("web")

/// Serves mh://app/... from the bundled files.
final class GameFiles: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path.isEmpty || url.path == "/" ? "/index.html" : url.path
        path = path.replacingOccurrences(of: "..", with: "")
        let file = webRoot.appendingPathComponent(path)
        guard let data = try? Data(contentsOf: file) else {
            task.didReceive(HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!)
            task.didReceive(Data()); task.didFinish(); return
        }
        let ext = file.pathExtension.lowercased()
        let mime = ["html": "text/html", "js": "text/javascript", "css": "text/css", "png": "image/png", "json": "application/json", "svg": "image/svg+xml", "wasm": "application/wasm"][ext] ?? "application/octet-stream"
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": mime, "Content-Length": "\(data.count)", "Cache-Control": "no-cache"])!)
        task.didReceive(data)
        task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

final class GameWebView: WKWebView {
    override var acceptsFirstResponder: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    var window: NSWindow!
    var web: GameWebView!
    let files = GameFiles()

    func applicationDidFinishLaunching(_ n: Notification) {
        buildMenu()
        let frame = NSRect(x: 0, y: 0, width: 1380, height: 900)
        window = NSWindow(contentRect: frame, styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
        window.title = "MATH-helper"
        window.titlebarAppearsTransparent = true
        window.minSize = NSSize(width: 980, height: 640)
        window.collectionBehavior = [.fullScreenPrimary]
        window.backgroundColor = NSColor(srgbRed: 0.55, green: 0.35, blue: 0.17, alpha: 1)
        window.center()

        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()                 // keeps your history, stars and report card between launches
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.preferences.isElementFullscreenEnabled = true
        cfg.setURLSchemeHandler(files, forURLScheme: "mh")
        web = GameWebView(frame: frame, configuration: cfg)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.setValue(false, forKey: "drawsBackground")
        web.autoresizingMask = [.width, .height]
        if #available(macOS 13.3, *) { web.isInspectable = true }
        window.contentView = web
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        load(query: launchQuery())
        if CommandLine.arguments.contains("--fullscreen") { window.toggleFullScreen(nil) }
        if let i = CommandLine.arguments.firstIndex(of: "--shot"), i + 1 < CommandLine.arguments.count {
            // --shot PATH [--delay S]: save a picture of the window, then quit (for testing)
            let path = CommandLine.arguments[i + 1]
            var delay = 8.0
            if let d = CommandLine.arguments.firstIndex(of: "--delay"), d + 1 < CommandLine.arguments.count { delay = Double(CommandLine.arguments[d + 1]) ?? 8 }
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                self?.web.takeSnapshot(with: nil) { img, _ in
                    if let img = img, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) { try? png.write(to: URL(fileURLWithPath: path)) }
                    NSApp.terminate(nil)
                }
            }
        }
    }
    /// --query "level=5&..." passes test flags to the page
    func launchQuery() -> String { if let i = CommandLine.arguments.firstIndex(of: "--query"), i + 1 < CommandLine.arguments.count { return CommandLine.arguments[i + 1] }; return "" }
    func load(query: String) { web.load(URLRequest(url: URL(string: "mh://app/index.html" + (query.isEmpty ? "" : "?" + query))!)) }
    @objc func reload() { load(query: "") }
    @objc func showCalc() { web.evaluateJavaScript("MH.show('calc')") }
    @objc func showPractice() { web.evaluateJavaScript("MH.show('practice')") }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = message; a.runModal(); completionHandler()
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = message; a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        completionHandler(a.runModal() == .alertFirstButtonReturn)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = action.request.url { NSWorkspace.shared.open(u) }
        return nil
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    private func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem(); main.addItem(appItem)
        let m = NSMenu()
        m.addItem(withTitle: "About MATH-helper", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        m.addItem(.separator())
        m.addItem(withTitle: "Hide MATH-helper", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        m.addItem(withTitle: "Quit MATH-helper", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = m
        let editItem = NSMenuItem(); main.addItem(editItem)
        let e = NSMenu(title: "Edit")
        e.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        e.addItem(.separator())
        e.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        e.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        e.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        e.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = e
        let viewItem = NSMenuItem(); main.addItem(viewItem)
        let v = NSMenu(title: "View")
        v.addItem(withTitle: "Calculator", action: #selector(showCalc), keyEquivalent: "1").target = self
        v.addItem(withTitle: "Practice", action: #selector(showPractice), keyEquivalent: "2").target = self
        v.addItem(.separator())
        v.addItem(NSMenuItem(title: "Toggle Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f"))
        viewItem.submenu = v
        NSApp.mainMenu = main
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
