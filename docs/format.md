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
- Notes are opt-in: an existing nested `[!note]` enables note controls. An empty one shows Add note; a filled one shows Edit note. Add the first empty marker in source view. Plain tasks and answer callouts without that marker receive no note controls, and saves never create an implicit note wrapper.
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

## Prototype: question in the callout

This local branch implements a second, explicit format: `[!question] Title`, `[!question|choice] Title`, and `[!question|choices] Title`. The required title is the question. The body is the answer, with the existing Other and trailing nested note fields. A blue question icon means unanswered; a green check icon means answered. Pick kinds remain visible next to the title. Text gets Answer… or Edit; choices get checkboxes and Other. Notes appear only when explicitly seeded with `[!note]`.

Two syntax options were considered:

| Option                                         | Shape                                                         | Tradeoff                                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Question in the title (implemented)            | `[!question                                                   | choice] Which route?` with the answer in its body                                                         | One callout, short Markdown, reuses the answer writer; no task-completion checkbox. |
| Wrapper around a task and answer (sketch only) | `[!question]` around the existing task and nested `[!answer]` | Keeps task completion, but adds quoting and a second callout and needs a different nested rendering path. |

The wrapper alternative would look like this; it is not recognized by this prototype:

```markdown
> [!question]
>
> - [ ] When should we leave?
>
>   > [!answer]
>   > After lunch.
```

The title form is the pick for this experiment. It gives the question and answer a single visible box and reuses the current independent answer and note snapshots. Keep the legacy form when a completion checkbox matters.

### Text: before and after

Before:

```markdown
- [ ] What time works for you?

  > [!answer]
  > Before dinner.
```

After:

```markdown
> [!question] What time works for you?
> Before dinner.
```

Leave the body empty to get Answer…; saved text has Edit. The question stays in the title while editing.

### Single choice: before and after

Before:

```markdown
- [ ] When should we leave?

  > [!answer|choice]
  >
  > - [ ] 🤖 After lunch
```

After:

```markdown
> [!question|choice] When should we leave?
>
> - [ ] 🤖 After lunch
```

The title shows “pick 1”. A single pick includes Other; choosing one clears the other.

### Multiple choice: before and after

Before:

```markdown
- [ ] What should we bring?

  > [!answer|choices]
  >
  > - [x] Water
  > - [ ] A snack
```

After:

```markdown
> [!question|choices] What should we bring?
>
> - [x] Water
> - [ ] A snack
```

The title shows “pick 1+”. Several options and Other may be selected together.

### Other: before and after

Before:

```markdown
- [ ] Which route?

  > [!answer|choice]
  >
  > - [ ] Along the river
  > - [ ] Through the park
  >
  > Other: A stop at the market.
```

After:

```markdown
> [!question|choice] Which route?
>
> - [ ] Along the river
> - [ ] Through the park
>
> Other: A stop at the market.
```

Other is the sole saved pick here. It renders as a checked row with Edit. An empty Other row has only its checkbox; ticking it opens the editor and clears a single selected option immediately. Save stores custom text; Cancel keeps the draft.

### Notes: before and after

Before:

```markdown
- [ ] Which route?

  > [!answer|choice]
  >
  > - [x] Along the river
  > - [ ] Through the park
  >
  > > [!note]
  > > Check the weather before we go.
```

After:

```markdown
> [!question|choice] Which route?
>
> - [x] Along the river
> - [ ] Through the park
>
> > [!note]
> > Check the weather before we go.
```

An empty nested note enables Add note. A filled one enables Edit note. With no marker, there is no note control. Notes remain separate from the answer and never count as answers.

### Compatibility and limits

- Existing task questions with `[!answer]` continue to parse, render, and save as before. Their custom callout titles still describe the answer; they are not reinterpreted as questions. Checked tasks remain editable. There is no automatic migration or change to existing files.
- The prototype recognizes only standalone, top-level `[!question]` callouts with nonempty, one-line titles and explicit `>` markers on every body line. Separate callouts with a blank line. Missing titles, unsupported kinds, conflicting single picks, and malformed note fields receive no controls. Fences, HTML examples, nested quotes, embedded notes, and list-nested question callouts stay ordinary Markdown.
- Question-title Markdown is matched to its rendered label, including emphasis and link labels. Titles must be unique across both formats in the file; even unsupported copies with the same title prevent a save. Changing the title, kind, collapse marker, or field source refuses an outstanding save and retains the draft.
- The new form has no independent task-completion state. Its check icon reports a saved answer, not task completion. Collapsible callouts are supported. Body fields keep their existing option syntax, line endings, indentation, and independent note validation, and all writes still use `Vault.process` against the original file identity.
- Without Tincan, Obsidian still displays the question title and plain Markdown body. The text remains readable, and option markers are ordinary Markdown tasks. The prototype has been kept on a local branch and is not installed into the personal vault.
