# Format and save rules

## Question structure

A question is a standalone, top-level callout. Its nonempty, one-line title is the question; its body holds the answer. Separate callouts with a blank line and use an explicit `>` marker on every body line, including blank lines.

A blank `>` line between the title and body is optional for all three kinds. Text and options can start directly under the title.

- `[!question] Title` accepts a text answer, which may contain Markdown.
- `[!question|choice] Title` accepts one pick, counting nonblank Other as a pick.
- `[!question|choices] Title` accepts multiple picks, optionally with Other.

```markdown
> [!question] What time works for you?
> Before dinner.

> [!question|choice] When should we leave?
>
> - [ ] 🤖 After lunch
> - [ ] Before dinner

> [!question|choices] What should we bring?
>
> - [x] Water
> - [x] A snack
> - [ ] A jacket
```

Callouts retain the theme’s native layout. Answered questions use the theme’s success color and a check icon; an Answered label reports saved answer state, with no independent task-completion checkbox. Questions remain editable after answering. Collapsible callouts, title Markdown, LF/CRLF line endings, and missing final newlines are supported.

Empty text answers show Answer…; saved text shows Edit. Recommendations belong inside the answer as `🤖` option labels. A single unchecked recommendation in a choice callout offers a suggestion plus Other. Text answer bodies are always literal Markdown, including a line beginning with `🤖`.

## Picks and Other

Options must be flat, one-line `- [ ] Label` or `- [x] Label` entries, each with its own `>` marker. Labels must be nonempty and distinct. Single picks show “pick 1”; multiple picks show “pick 1+”.

The compact layout works too:

```text
> [!question|choice] Which route?
> - [ ] Along the river
> - [ ] Through the park
```

An optional `Other:` section follows the options:

```markdown
> [!question|choice] Which route?
>
> - [ ] Along the river
> - [ ] Through the park
>
> Other: Past the market.
```

A checked option or nonblank Other counts as answered. For a single pick, selecting an option clears all other options and Other. Opening the custom answer editor keeps the saved option unchanged; saving nonblank Other clears every option. For multiple picks, Other can accompany checked options.

Write another answer… opens the custom answer editor or resumes a canceled draft. Saved Other text appears in an Other answer callout with Edit and Clear actions; its Markdown stays an Other: paragraph. Clear removes only the custom text. Opening or canceling the editor does not write to the note. Cancel retains the draft.

Choices use the theme's native list layout and text appearance. Checkbox state identifies selected options; nonblank Other is the custom answer. The custom answer has no checkbox in either native Markdown or Tincan.

Conflicting single picks, duplicate labels, unsupported kinds, missing titles, and malformed bodies receive no Tincan controls. Source stays unchanged. Correct the source to keep one pick, or use the multiple-pick kind when several answers are intended.

## Explicit notes

A nested `[!note]` must be the final direct child of the question callout:

```markdown
> [!question] What should we try next?
> A weekend workshop.
>
> > [!note]
> > Ask again after checking the dates.
```

Answer and note are independent fields. A note never counts as an answer. Add a note opens the note editor for a question without a note. Saving creates a trailing nested `[!note]`. A filled existing note shows Edit note, and an empty one shows Add note. You can also write an empty marker in source view:

```markdown
> [!question] What should we revisit?
>
> > [!note]
```

Opening or canceling Add a note does not change the Markdown. Creating a note validates that no other note has appeared since the editor opened. Note creation preserves the current answer, including changes saved while the note editor was open.

## Writing and identity

Text and notes save on Done, Other text on Save, and option changes immediately. Every write uses `Vault.process`, with validation inside its synchronous callback.

- Question text must occur exactly once among recognized questions in the current file, including unsupported copies with the same title.
- The original file object must still exist, and every open copy must be in reading view.
- Question context and original field source must match. Changing a title, kind, or collapse marker refuses an outstanding save. Answer and note snapshots are independent, so editing one preserves the other.
- Ambiguous or changed targets refuse the write and keep the draft.
- Writes preserve unrelated bytes, indentation, line endings, and surrounding content. Pick changes preserve option labels; switching away from Other in a single-pick answer removes its saved custom prose.

`Vault.process` protects the local read/transform/write operation. Later external writes or Sync merges can still conflict. Identical deleted and recreated questions cannot be distinguished without persistent ids.

## Drafts

Drafts belong to the original file and field, independently of rendered sections. Redrawing or moving between inline and popup editors retains text and focus. A file changing its name retains its identity.

Cancel keeps drafts in memory for the current session. Restarting the app, disabling the plugin, or terminating the app in the background loses unsaved work. Resume draft opens a retained draft again.

## Reading view and runtime

Controls work in ordinary reading-view note panes. Code fences, HTML examples, nested quotes, embeds, and question callouts inside lists stay ordinary Markdown. Bodies must use explicit quote markers; lazy unquoted continuation lines and merged question headers are refused.

Without Tincan, Obsidian still displays the question title and its plain Markdown body. Option markers remain ordinary Markdown tasks.

The plugin uses Obsidian and browser APIs, with no Node or Electron imports in the runtime bundle. Desktop and mobile share the controls. Checkboxes intercept activation so Obsidian's native task handler cannot write a second time.
