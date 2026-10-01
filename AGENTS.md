# Repository Guidelines

## Project Structure & Sources

This React, TypeScript, and Vite app keeps its editor in `src/App.tsx`, autocomplete and guided tour in `src/components/`, project validation, migration, and text export in `src/lib/project.ts`, and styles in `src/styles.css`. Movement and tour content live in `src/data/mouvements.json` and `src/data/tutoriel.json`; category icons are SVG files in `public/resources/icons/`. `Dockerfile` builds the static site, `compose.yaml` runs it, and `nginx/default.conf` configures the static server and response headers. The FFE source used for guard positions, footwork, combined techniques, and offensive actions is the *Sabre Laser — Livret 1, Cahier technique* PDF (v02.7.2), located beside this repository in the current workspace. Keep lexicon descriptions faithful to the corresponding chapters. Do not commit generated `dist/` files.

## Build, Test & Development Commands

- `npm ci` installs the locked dependencies.
- `npm run dev` starts the local Vite server.
- `npm test` runs Vitest and React Testing Library tests.
- `npm run build` type-checks and produces `dist/`.
- `npm run security:audit` checks for high-severity dependency advisories.
- `docker compose up --build` builds and starts the production container on port 8080.

## Coding & Data Conventions

Use two-space indentation, React function components, descriptive camelCase names, and French UI text. Movement records have `nom`, `description`, and `categorie` (`main`, `pieds`, or `combine`), and may have `caracteristiques`, an optional list of detail suggestions. In the free-detail fields, offer those suggestions only for a matching movement and replace only the comma-delimited segment at the caret. Preserve other text and free entry. A combined movement is selected in the hand field and clears the foot field. Fighter action names remain separate from FFE identity details; committing a name on Enter or blur replaces exact attacker and defender matches. Project metadata, fighter records, assistants, and phrases are all part of the local draft. Keep field normalization and limits in `src/lib/project.ts`. Drafts use `forgechoree.project.v5` and contain at least one phrase; phrase starts derive from the previous end. Preserve migrations from older storage keys when changing the shape. The opposition-duration calculator sums timed spans only for phrases with a started line, while empty phrases still determine later phrase starts.

## Testing Guidelines

Place focused `.test.ts` or `.test.tsx` files beside the code they cover. Exercise editor behavior, guided-tour order and cancellation, its empty-line target, project metadata and participant details, opposition-duration calculation, phrase grouping and timing, line ordering/movement between phrases, lexicon categories and characteristic suggestions, comma-segment completion in both detail fields, defender reactions, exact fighter-name replacement, draft persistence/migration, and text export where affected. Empty phrases stay editable but are omitted from export; movement lines must belong to a phrase. Run `npm test` and `npm run build` for application changes.

## Commits, Pull Requests & Security

Git history uses short English imperative subjects, such as `Add Defender reaction`; no formal prefix is established. PRs should describe user-visible behavior, report relevant checks, and include screenshots for visual changes. Keep `package-lock.json` synchronized with dependency changes. Read `SECURITY.md` before changing rendering, persistence, dependencies, or deployment headers. Render stored and entered values as text, never HTML; the local draft is unencrypted and must not contain secrets. Keep `.env` files out of version control.
