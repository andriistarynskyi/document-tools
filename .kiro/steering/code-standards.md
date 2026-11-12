# Code Standards — document-tools

## Stack

- TypeScript, plain HTML, CSS — no UI frameworks
- Bundled with webpack, typed with `tsc`
- Add npm packages only when the alternative is significant hand-rolled complexity.
  Before adding any package: state what it replaces and why the built-in approach falls short.

## File size

- Target ≤ 200 lines per file.
- If a file grows beyond that, split it by responsibility — not by arbitrary line count.
  Each new file must have a single, nameable purpose.

## Module design (SOLID)

**Single Responsibility** — one file, one concern.
Examples of correct splits:
- `fragment-extractor.ts` — turns pdf.js output into typed Fragment objects
- `line-builder.ts` — groups fragments into visual lines
- `column-detector.ts` — builds Column definitions from a header cluster
- `body-collector.ts` — collects data rows given a Column layout
- `table-merger.ts` — cross-page merge logic
- `export.ts` — XLSX workbook construction and download
- `main.ts` — wires DOM events to the pipeline, nothing else

**Open/Closed** — extend behaviour by adding modules or passing different implementations,
not by editing existing logic. Use interfaces and dependency injection for anything
that varies between document types.

**Liskov / Interface Segregation** — keep interfaces narrow.
A consumer of `Column[]` should not need to know how columns were built.
Avoid god-interfaces; prefer small, focused ones.

**Dependency Inversion** — high-level orchestration code (e.g. `extractTables`) depends
on abstractions (`FragmentExtractor`, `ColumnDetector`), not on concrete implementations.
Pass collaborators in; do not `import` and call directly inside logic functions.

## TypeScript

- `strict: true` always. No `any`, no `as unknown as X` unless there is no alternative
  and the reason is documented in a comment.
- Prefer `interface` for shapes that may be implemented or extended.
  Use `type` for unions, intersections, and aliases.
- Export only what other modules need. Keep internal helpers unexported.
- Avoid barrel (`index.ts`) re-exports unless the public API surface genuinely needs one.

## Naming

- Files: `kebab-case.ts`
- Types / interfaces: `PascalCase`
- Functions and variables: `camelCase`
- Constants (module-level, never reassigned): `SCREAMING_SNAKE_CASE`
- Boolean variables and functions: prefix with `is`, `has`, or `can`

## Functions

- One function, one action. If you need "and" to describe what it does, split it.
- Pure functions wherever possible — same inputs, same outputs, no side effects.
- Side-effectful code (DOM, fetch, file I/O) lives in its own layer, isolated from
  pure logic so the logic can be unit-tested without a browser.
- Max function length: ~40 lines. Longer functions are a signal to extract helpers.

## Testability

- Pure logic modules must have no DOM or pdf.js imports — they take plain data in
  and return plain data out. This makes them unit-testable with any test runner
  without a browser environment.
- Separate "what to compute" from "how to trigger it". The DOM wiring in `main.ts`
  should be thin glue; all real logic is importable and testable independently.
- When adding a new feature, write the logic in a pure function first, verify it
  works in isolation, then wire it to the DOM.

## Error handling

- Distinguish recoverable user errors (bad file, password-protected PDF) from
  unexpected exceptions. Surface recoverable errors with a friendly message;
  log unexpected ones with `console.error` and show a generic fallback message.
- Never swallow errors silently. Every `catch` block must either re-throw, log,
  or explicitly handle the case with a comment explaining why silence is correct.

## CSS

- Use CSS custom properties (`--var-name`) for all design tokens (colours, spacing, shadows).
- No inline styles except for values that are genuinely dynamic at runtime
  (e.g. a progress bar width set by JavaScript).
- Class names: `kebab-case`, semantic rather than visual (`.drop-zone`, not `.blue-box`).

## HTML

- Semantic elements first (`<header>`, `<main>`, `<dialog>`, `<button>`).
- Every interactive element must be keyboard-accessible and have a visible focus style.
- `aria-*` attributes where native semantics are insufficient.
- CSP meta tag present in production builds (injected by webpack, absent in dev).

## Git hygiene

- Commit one logical change per commit.
- Commit message: imperative mood, ≤72 chars (`Fix column Voronoi boundary off-by-one`).
- Do not commit `dist/`, `node_modules/`, or generated `.js` files from `src/`.
