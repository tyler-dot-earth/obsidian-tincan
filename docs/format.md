# Format and save rules

## Question structure

- A question is a Markdown task with one direct `[!answer]`, `[!answer|choice]`, or `[!answer|choices]` callout. Checked and unchecked questions remain editable.
- Text answers may contain Markdown and are always literal text, including lines beginning with `🤖`. Empty text answers use Answer…; saved text uses Edit.
- A suggestion is a single unchecked `- [ ] 🤖 Suggestion` option inside `[!answer|choice]`. It starts unanswered and renders a checkbox plus Other. Ticking saves the suggestion immediately; Other saves custom text on Save. The option remains in the Markdown after saving.
- To migrate the earlier `> [!answer]` / `> 🤖 Suggestion` format, change the callout to `> [!answer|choice]` and the body line to `> - [ ] 🤖 Suggestion`.
- Pick options are flat, one-line `- [ ] Label` or `- [x] Label` entries, each with its own `>` marker. Labels must be nonempty and distinct. Single-choice questions allow at most one pick, counting nonblank Other as a pick.
- An optional `Other:` section follows the options. A checked option or nonblank Other counts as answered. For `[!answer|choice]`, picking an option clears Other, and saving Other clears every option. For `[!answer|choices]`, Other may accompany checked options.
- Ticking an empty Other checkbox in a single-choice question immediately clears its saved option and opens the editor. An unanswered Other row has no separate button; tick its checkbox again to resume a canceled draft. Saved Other text keeps Edit. Cancel keeps the draft; it does not undo a previously saved checkbox change.
- Existing single-choice blocks with two checked options, or a checked option plus nonblank Other, are invalid. Tincan leaves their Markdown unchanged and provides no reading-view controls. Correct the source to keep one pick, or use `[!answer|choices]` for multiple answers.
- A nested `[!note]` must be the final direct child of the answer callout. Answer and note are separate fields, and notes never count as answers.
- Add note and Edit note use small native Obsidian buttons, visible at rest, below the answer.
- Context may appear before the answer, but recommendations belong inside it. Other direct callout types leave the question without controls.
- Tabs, LF/CRLF line endings, custom titles, collapsible callouts, and nested task questions are supported. Questions inside quotes, code, HTML, frontmatter, and embeds receive no controls.

## Writing

Text and notes save on Done, custom pick text on Save, and picks immediately. Every write uses `Vault.process`, with validation inside its synchronous callback.

- The question text must occur exactly once among task questions in the current file, including completed and unsupported copies.
- The original file object must still exist, and every open copy must be in reading view.
- The question context and the original field source must match. Answer and note snapshots are independent, so editing one preserves the other.
- Ambiguous or changed targets refuse the write. Drafts remain available through Resume draft.
- Writes preserve unrelated bytes, indentation, line endings, and parent task states. Pick changes preserve option text; switching away from Other in a single-choice answer removes its saved custom prose.

`Vault.process` protects the local read/transform/write operation. Later external writes or Sync merges can still conflict. Identical deleted and recreated questions cannot be distinguished without persistent ids.

## Drafts

Drafts belong to the original file and field, independently of rendered sections. Redrawing or moving between inline and popup editors retains text and focus. A file changing its name retains its identity.

Drafts live in memory for the current session. Restarting the app, disabling the plugin, or terminating the app while it is in the background loses unsaved work.

## Runtime

The plugin uses Obsidian and browser APIs, with no Node or Electron imports in the runtime bundle. Desktop and mobile share the same controls. Checkboxes intercept activation so Obsidian's native task handler cannot write a second time.
