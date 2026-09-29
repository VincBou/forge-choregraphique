# Repository Guidelines

## Project Structure & Sources

This React, TypeScript, and Vite app keeps its editor in `src/App.tsx`, autocomplete in `src/components/`, project validation, migration, and text export in `src/lib/project.ts`, and styles in `src/styles.css`. The movement lexicon is `src/data/mouvements.json`; category icons are SVG files in `public/resources/icons/`. `Dockerfile` builds the static site, `compose.yaml` runs it, and `nginx/default.conf` configures the static server and response headers. The FFE source used for guard positions, footwork, and combined techniques is the *Sabre Laser — Livret 1, Cahier technique* PDF (v02.7.2), located beside this repository in the current workspace. Keep the lexicon selective and descriptions faithful to its corresponding chapters. Do not commit generated `dist/` files.

## Build, Test & Development Commands

- `npm ci` installs the locked dependencies.
- `npm run dev` starts the local Vite server.
- `npm test` runs Vitest and React Testing Library tests.
- `npm run build` type-checks and produces `dist/`.
- `npm run security:audit` checks for high-severity dependency advisories.
- `docker compose up --build` builds and starts the production container on port 8080.

## Coding & Data Conventions

Use two-space indentation, React function components, descriptive camelCase names, and French UI text. Movement records have `nom`, `description`, and `categorie` (`main`, `pieds`, or `combine`). A combined movement is selected in the hand field and clears the foot field. Autocomplete suggestions are optional; preserve free text. Fighter renames commit on Enter or blur and replace exact attacker and defender name matches across all phrases. An existing fighter name left blank reverts. Keep field normalization and limits in `src/lib/project.ts`. Drafts use `forgechoree.project.v4` and contain at least one phrase; each phrase owns its lines and end time, while its start is the preceding phrase’s end (or `0.0`). Preserve migrations from older storage keys when changing the shape.

## Testing Guidelines

Place focused `.test.ts` or `.test.tsx` files beside the code they cover. Exercise editor behavior, phrase grouping and timing, line ordering/movement between phrases, lexicon categories, defender reactions, exact fighter-name replacement, draft persistence/migration, and text export where affected. Empty phrases stay editable but are omitted from export; movement lines must belong to a phrase. Run `npm test` and `npm run build` for application changes.

## Commits, Pull Requests & Security

Git history uses short English imperative subjects, such as `Add Defender reaction`; no formal prefix is established. PRs should describe user-visible behavior, report relevant checks, and include screenshots for visual changes. Keep `package-lock.json` synchronized with dependency changes. Read `SECURITY.md` before changing rendering, persistence, dependencies, or deployment headers. Render stored and entered values as text, never HTML; the local draft is unencrypted and must not contain secrets. Keep `.env` files out of version control.
