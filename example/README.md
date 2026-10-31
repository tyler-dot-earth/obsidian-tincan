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
- Tick the 🤖 suggestion or use Write another answer… to open the custom answer editor. Saved custom text appears in an Other answer callout with Edit and Clear actions. Opening or canceling the editor keeps saved picks unchanged.
- Switch a single pick, select several multiple picks, and save Other. Single picks clear competing answers; multiple picks can accompany Other.
- Notice saved answers use the theme’s success color and a check icon. Pick instructions stay above the choices; checkboxes align with the first line of wrapped text. Clearing the last saved answer restores the question appearance.
- Edit a note without changing the answer. Use Add a note beside the answer actions to create a nested note on save. The last question also has an empty note to try Add note; filled notes have Edit note.

`Showcase.md` is the compact “A day out” example for screenshots. It includes text, a suggestion, single and multiple picks, saved Other, and one explicit note. Both notes remain readable Markdown without the plugin.
