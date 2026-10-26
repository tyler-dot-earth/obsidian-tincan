# Sample vault

Synthetic title questions for trying Tincan without using personal notes.

## Open it

From the repository root:

```fish
pnpm install --frozen-lockfile
pnpm build
bash example/setup-plugin.sh
```

In Obsidian, choose Open folder as vault and select `example/vault`. Turn Restricted mode off, enable Tincan, and open `Questions.md` in reading view.

The setup script copies only `main.js`, `manifest.json`, and `styles.css`. Run it again after rebuilding. Plugin files and workspace state are ignored by Git.

## Try it

- Open the empty text question with Answer…, type an answer, save with Done, and edit it again. The question stays in the callout title.
- Tick the 🤖 suggestion or tick Other to open the editor and save your own answer. Unanswered Other rows have no button; saved Other text has Edit.
- Switch a single pick, select several multiple picks, and save Other. Single picks clear competing answers; multiple picks can accompany Other.
- Notice selected answers are emphasized and unselected labels are muted after a pick is chosen. Muted options remain clickable, and clearing the last pick restores the unanswered appearance.
- Edit a note without changing the answer. Only an explicit nested `[!note]` gets note controls. The last question has an empty one to try Add note; filled ones have Edit note.

`Showcase.md` is the compact “A day out” example for screenshots. It includes text, a suggestion, single and multiple picks, saved Other, and one explicit note. Both notes remain readable Markdown without the plugin.
