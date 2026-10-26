# Sample vault

Synthetic questions for trying Tincan without using personal notes.

## Open it

From the repository root:

```fish
pnpm install --frozen-lockfile
pnpm build
bash example/setup-plugin.sh
```

In Obsidian, choose Open folder as vault and select `example/vault`. Turn Restricted mode off, enable Tincan, and open `Questions.md` in reading view.

The setup script copies only `main.js`, `manifest.json`, and `styles.css`. Run it again after rebuilding. The plugin files and workspace state are ignored by Git.

## Try it

- In “When should we leave?”, tick the single 🤖 suggestion or tick Other to open the editor and save your own answer. Unanswered Other rows have no button; saved Other text has Edit. Untick the saved row to clear it.
- Type an answer in a plain text callout and edit a saved answer.
- Switch a single pick, tick several picks, and save an Other answer.
- In `Showcase.md`, “Which route?” starts with only Other selected. Pick “Along the river” to clear Other, then save a new Other answer to clear the route option. Multi-pick questions allow Other alongside their options.
- Edit a note without changing the answer, including on a completed question.
- In `Showcase.md`, try the small Add note and Edit note buttons below each answer. Their native Obsidian styling is visible before hovering.

`Showcase.md` is a compact version for screenshots. Both notes are ordinary Markdown without the plugin.
