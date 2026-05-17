# Repository Guidelines

## Project Structure & Module Organization

`scripts/` contains the Node/Playwright automation entry points such as `capture.js`, `save-session.js`, and `run-pipeline.sh`. Generated dashboards live in `reports/` as `YYYYMMDD_dashboard.html`. Runtime artifacts go to `screenshots/YYYYMMDD/` and `logs/`; both are local-only. Store browser sessions in `sessions/` and keep reference material in `references/`. Planning and project memory belong in `docs/`, especially `docs/todo.md` and `docs/lessons.md`.

## Build, Test, and Development Commands

Run `npm install` to install dependencies, then `npx playwright install chromium` once per machine. Use `npm run save-session:tv` or `npm run save-session:coinalyze` to refresh login state before captures. `npm run capture` collects all charts, while `npm run capture:tv` and `npm run capture:orderflow` run narrower slices. `npm run pipeline` executes capture plus analysis; `npm run pipeline:capture` and `npm run pipeline:analyze` split that flow. For focused checks, run scripts directly, for example `node scripts/test-extract.js` or `node scripts/verify-price-fix.js`.

## Coding Style & Naming Conventions

Match the existing CommonJS Node style: 2-space indentation, semicolons, `const` by default, camelCase for functions, and UPPER_SNAKE_CASE for shared constants like target lists. Keep filenames in `scripts/` kebab-case (`save-session.js`, `run-pipeline.sh`). Add brief comments only where selectors, timing, or platform quirks are non-obvious.

## Testing Guidelines

There is no Jest or Vitest suite here. Validation is script-driven: add or update focused Playwright checks under `scripts/` using names like `test-*.js` or `verify-*.js`, then run the affected script locally. When dashboard output changes, regenerate the relevant report and inspect the latest file in `reports/` alongside any produced logs.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits: `feat: dashboard 20260418`, `docs: ...`, `chore: ...`. Keep subjects short and imperative. PRs should include the purpose, the commands you ran, affected data sources or platforms, and screenshots when dashboard UI/output changes.

## Security & Configuration Tips

Never commit `sessions/`, `logs/`, `screenshots/`, or `scripts/config/clean-layout.json`. Treat session JSON files and `sessions/coinalyze-api-key.txt` as secrets. If you need reproducibility notes, document the setup in `docs/` rather than checking in local credentials.
