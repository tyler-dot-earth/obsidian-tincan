# Tincan

Obsidian plugin for answering task questions in reading view. Plugin id `tincan`. Answers and notes stay in body callouts as plain Markdown.

## Layout

- `src/main.ts` is the Obsidian host boundary: lifecycle, commands, panes, and file identity.
- `src/question-blocks.ts` parses questions; `src/answer-content.ts` defines text and pick content; `src/nested-notes.ts` separates note fields.
- `src/answer-target.ts` validates source identity and builds replacements; `src/save-answer.ts` runs the named Effect write program.
- `src/drafts.ts` owns session drafts independently of disposable Markdown DOM. Render children own controls through `src/answer-renderer.ts` and `src/question-control.ts`.
- Package imports use `#/src/module-name`. Release artifacts are `main.js`, `manifest.json`, and `styles.css` at the repository root.
- `fixtures/` and `example/vault` contain synthetic content only. Use clean example-vault screenshots; never commit personal content or machine configuration.

## Markdown and safety

- Keep one format: `[!answer]` for text, `[!answer|choice]` for one pick, `[!answer|choices]` for multiple picks, and a trailing nested `[!note]` for comments. Recommendations belong inside the answer. See `docs/format.md`.
- All writes use `Vault.process`, with synchronous validation of unique question text, original file identity, context, and field source. Never target by the active note or a remembered line number.
- Refuse ambiguous targets, changed source, unavailable files, and editable copies in other panes. Keep drafts on refusal or failure.
- Answer and note snapshots are independent. Preserve unrelated bytes, indentation, line endings, and task states. Checked questions remain editable.
- Choice controls intercept activation to prevent native task toggling from writing twice.
- Runtime code uses browser and Obsidian APIs only. Desktop and mobile share the same controls.

## Effect and tests

- Effect v4 rc, `@tyler.earth/effect-obsidian`, pnpm, Nix, oxfmt, type-aware oxlint, Vitest, esbuild, and lefthook.
- Keep named Effect programs outside the Plugin class. IO uses `Effect.fn` and `Schema.TaggedError`; Effect modules use no async/await or try/catch.
- DOM and synchronous transforms stay ordinary TypeScript. UI notices use short, direct sentences.
- Tests use `@effect/vitest` assertions and `it.effect`, with `TZ=UTC`. Mock system boundaries only; exercise real internal collaborators.
- Vendored lint rules retain their upstream provenance and notices under `tools/oxlint/anti-slop/`.
- Run `pnpm check` before finishing. Never bypass hooks, skip tests, or weaken checks to get green.

## Development vault

After `pnpm build`, run `bash example/setup-plugin.sh` and open `example/vault` in Obsidian. Copy or symlink only the three release files into `.obsidian/plugins/tincan/`; never link the whole repository. Preserve other plugin ids when enabling Tincan. See `example/README.md`.
