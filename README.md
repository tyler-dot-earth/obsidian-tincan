# Tincan 🥫

Answer questions inside Obsidian callouts in reading view. Put the question in the title and its answer in the body. Answers and notes stay in plain Markdown.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/tincan-dark.png">
  <img src="docs/images/tincan.png" alt="Tincan in Obsidian reading view: answered and unanswered questions, pick instructions, custom answers, and notes on individual options and the whole question." width="700">
</picture>

Write a question callout and switch to reading view. Unanswered questions keep your theme’s question appearance; saved answers use its success color and a check icon. The icon tracks the answer, with no separate task-completion checkbox.

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

Tap an option to save it immediately. Picking another clears the first, including Other; unticking clears your answer. A single 🤖 option is enough when you just want to offer a suggestion. The instruction above the choices says “pick 1”.

## Pick more than one

```markdown
> [!question|choices] What should we bring?
>
> - [x] Water
> - [x] A snack
> - [ ] A jacket
```

Tick any combination. Each tap saves, and the instruction above the choices says “pick 1+”. No Done button is needed for picks.

Checkboxes show selected options. Callouts, lists, and paragraphs follow your Obsidian theme, with the theme’s success color, a check icon, and an Answered label when an answer is saved.

## Write something else

Every pick question offers Write another answer…. Open the editor, type your answer, and press Save. Opening or canceling keeps saved picks unchanged. Saving a custom answer clears the options in a single-pick question, and picking an option clears the custom answer. Multiple picks can accompany a custom answer.

```markdown
> [!question|choice] How should we meet?
>
> - [ ] In person
> - [ ] Video call
>
> Other: A phone call.
```

Saved Other text appears in an Other answer callout with Edit and Clear actions. The Markdown stays a plain Other: paragraph. Clear removes only the custom answer. Clearing it or replacing it with a single pick asks for confirmation first. If you cancel an unsaved custom draft, use Write another answer… again to resume it.

## Leave a note

Each checkbox option has its own Add a note action. Saved notes appear beneath that option as native nested callouts. They stay attached to the option when you select or deselect answers; you can annotate an option without choosing it.

Add a trailing nested `[!note]` when you want a comment separate from the answer:

```markdown
> [!question] What should we try next?
> A weekend workshop.
>
> > [!note]
> > Ask again after checking the dates.
```

Use Add a note beside the answer actions to open the note editor. Saving creates a trailing nested `[!note]`; opening or canceling leaves the Markdown unchanged. Existing notes keep their native callout and Edit note action. A note never counts as an answer. Saving an existing note as empty asks for confirmation first.

Keep callouts at the document's top level, give each one a nonempty question title, and separate them with a blank line. Use `>` on every body line, including blank lines. The body can start directly under the title or after a blank `>` line; both layouts work for text, single picks, and multiple picks. See [the format and save rules](docs/format.md) for the details.

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

## Theme integration

Tincan aims to fit your theme by using Obsidian’s native styling and design tokens for colors, typography, spacing, and controls. We mainly test against the default Obsidian theme and [Baseline](https://github.com/svnaxis/obsidian-baseline).

## Development

```fish
nix develop
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

`pnpm dev` watches for changes. The Nix shell supplies Node, pinned pnpm, and lefthook, and configures the Git hooks. Copy or symlink only the three release files into a development vault.

## Saving and drafts

- If a pick cannot save, its draft stays visible with the refusal reason and Retry.
- Saves check the current question and answer before writing. Duplicate questions, concurrent changes, and editable copies in other panes refuse the save and keep the draft.
- Cancel keeps a draft in memory. Resume draft opens it again; restarting Obsidian or disabling Tincan loses unsaved drafts.
- Rendered questions in Live Preview share the reading view’s answered colors, icons, pick hints, option-note spacing, and custom-answer callouts. Native checkboxes and source editing remain owned by Obsidian.
- Controls work in reading-view note panes. Code examples, embeds, and unsupported question structures stay ordinary Markdown.

See [the format and save rules](docs/format.md) for the details.

## Releases

The check workflow runs `pnpm check` on pushes to `main` and pull requests. The release workflow checks a bare version tag, such as `0.1.0`, runs the full check, attests the build, and attaches the three plugin files to a GitHub release.

`pnpm release -- patch` uses the release helper to bump versions, commit, tag, and push to remotes named `github` and `origin`. `versions.json` maps each release to its minimum Obsidian version.

License is [0BSD](LICENSE). Vendored tooling keeps its original notices.
