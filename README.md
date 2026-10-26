# Tincan 🥫

Answer questions inside Obsidian callouts in reading view. Put the question in the title and its answer in the body. Answers and notes stay in plain Markdown.

![Question titles, text answers, picks, Other, and an explicit note in reading view.](docs/images/tincan.png)

Write a question callout and switch to reading view. A blue question icon marks an unanswered question; a green check marks a saved answer. The icon tracks the answer, with no separate task-completion checkbox.

## Text answers

```markdown
> [!question] What time works for you?
```

Answer… opens a blank editor, and Done saves your answer. Saved text has Edit. The question stays in the title while you edit its answer.

## Pick one

```markdown
> [!question|choice] When should we leave?
>
> - [ ] 🤖 After lunch
> - [ ] Before dinner
```

Tap an option to save it immediately. Picking another clears the first, including Other; unticking clears your answer. A single 🤖 option is enough when you just want to offer a suggestion. The title says “pick 1”.

## Pick more than one

```markdown
> [!question|choices] What should we bring?
>
> - [x] Water
> - [x] A snack
> - [ ] A jacket
```

Tick any combination. Each tap saves, and the title says “pick 1+”. No Done button is needed for picks.

After any pick or Other is selected, selected text is emphasized and unselected labels are muted. Colors and weight follow your Obsidian theme. Muted choices remain clickable; unanswered questions keep their usual appearance.

## Write something else

Every pick question has an Other row. Tick its checkbox, type your answer, and press Save. In a single-pick question, ticking empty Other clears the saved option immediately. Saving Other clears the options, and picking an option clears Other. Multiple picks can accompany Other.

```markdown
> [!question|choice] How should we meet?
>
> - [ ] In person
> - [ ] Video call
>
> Other: A phone call.
```

Saved Other text reads as a checked row with Edit. Unticking it clears the custom answer. If you cancel an unsaved Other draft, tick the row again to resume it; an unanswered Other row has no separate button.

## Leave a note

Add a trailing nested `[!note]` when you want a comment separate from the answer:

```markdown
> [!question] What should we try next?
> A weekend workshop.
>
> > [!note]
> > Ask again after checking the dates.
```

Only an explicit `[!note]` gets note controls. A filled note has Edit note. Add an empty nested `[!note]` in source view to get Add note in reading view. Both are small native Obsidian buttons. A note never counts as an answer.

Keep callouts at the document's top level, give each one a nonempty question title, and separate them with a blank line. Use `>` on every body line, including blank lines. See [the format and save rules](docs/format.md) for the details.

## Install

Requires Obsidian 1.13.0 or newer, on desktop or mobile.

For a manual install, build the plugin or get the three files from a release:

1. Copy `main.js`, `manifest.json`, and `styles.css` into `Vault/.obsidian/plugins/tincan/`.
2. Turn Restricted mode off under Settings → Community plugins, and enable Tincan.
3. Open a note in reading view.

For Obsidian Sync, enable syncing the installed and active community plugin lists on each device. Let syncing finish, restart the receiving app, and enable Tincan there.

## Sample vault

`example/vault` contains synthetic title questions covering text, recommendations, single and multiple picks, Other, and explicit notes. Build the plugin, then run:

```fish
bash example/setup-plugin.sh
```

Open `example/vault` as a vault in Obsidian, enable Tincan, and open `Questions.md` in reading view. See [the example instructions](example/README.md).

## Development

```fish
nix develop
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

`pnpm dev` watches for changes. The Nix shell supplies Node, pinned pnpm, and lefthook, and configures the Git hooks. Copy or symlink only the three release files into a development vault.

## Saving and drafts

- Saves check the current question and answer before writing. Duplicate questions, concurrent changes, and editable copies in other panes refuse the save and keep the draft.
- Cancel keeps a draft in memory. Resume draft opens it again; restarting Obsidian or disabling Tincan loses unsaved drafts.
- Controls work in reading-view note panes. Code examples, embeds, and unsupported question structures stay ordinary Markdown.

See [the format and save rules](docs/format.md) for the details.

## Releases

The check workflow runs `pnpm check` on pushes to `main` and pull requests. The release workflow checks a bare version tag, such as `0.1.0`, runs the full check, attests the build, and attaches the three plugin files to a GitHub release.

`pnpm release -- patch` uses the release helper to bump versions, commit, tag, and push to remotes named `github` and `origin`. `versions.json` maps each release to its minimum Obsidian version.

License is [0BSD](LICENSE). Vendored tooling keeps its original notices.
