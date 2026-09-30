# MATH-helper

A realistic school calculator that shows **how** to do every problem, step by step, on notebook paper, plus a chalkboard **Practice** mode (12 subjects, Easy/Medium/Hard, stars, streaks and a report card). It also has a study radio with 4 made-up songs and sound effects.

- It understands order of operations, fractions, percents, powers and roots, trig, logs, and solves linear and quadratic equations in x.
- It draws written methods on paper: column addition (carrying), subtraction (borrowing), long multiplication and long division.
- Web: `web/public` is the whole app (plain JS, no build step). `render.yaml` sets it up as a static site.
- Mac: `mac/build.sh` builds `MATH-helper.app`, which runs offline through the `mh://` scheme.
- Tests: `node test/solve.mjs "2x+5=17"` and `node test/practice.mjs`.
