# Repository Guidelines

## Project Structure

This repository contains a React, TypeScript, and Vite single-page app. UI components live in `src/components/`; the main editor is `src/App.tsx`; shared project validation and export logic is in `src/lib/`; the movement lexicon is `src/data/mouvements.json`; category icons are static SVG resources in `public/resources/icons/`; and visual styles are in `src/styles.css`. Keep movement records as `{ "nom": string, "description": string, "categorie": "main" | "pieds" }` entries. `dist/` is generated output and must not be committed.

## Development Commands

- `npm ci` installs the exact dependency tree recorded in `package-lock.json`.
- `npm run dev` starts the local Vite development server.
- `npm test` runs the Vitest and React Testing Library suite.
- `npm run build` type-checks the app and creates the production site in `dist/`.
- `npm run security:audit` checks dependencies for known high-severity vulnerabilities.

## Code and Test Conventions

Use TypeScript for application code, React function components, two-space indentation, and descriptive camelCase names. Keep UI copy in French. Use React text rendering for user-controlled content; do not render entered or stored strings as HTML. Enforce the field limits and one-line normalization in `src/lib/project.ts` when changing input behavior. Current project drafts use the `forgechoree.project.v3` local storage key; preserve migration from earlier versions when changing the draft shape. Put tests beside the behavior they cover using `.test.ts` or `.test.tsx` filenames, and run `npm test` after changes.

## Commits and Pull Requests

No commit history establishes a convention yet. Use a short imperative subject, such as `Add movement descriptions`. Pull requests should describe user-visible changes, list build and test results, and include screenshots for visual changes. Explain any dependency updates and keep `package-lock.json` synchronized with `package.json`.

## Security and Configuration

Read `SECURITY.md` before changing persistence, rendering, dependencies, or deployment headers. The local draft is not encrypted and must not hold secrets. Keep secrets and local environment files out of version control; `.env` files are ignored.
