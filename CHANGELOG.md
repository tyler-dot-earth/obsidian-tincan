# Changelog

All notable changes to Tincan are documented here.

## [Unreleased]

## [0.2.0] - 2026-10-26

### Changed

- **Breaking:** Questions now use standalone `[!question]`, `[!question|choice]`, or `[!question|choices]` callouts. The title is the question, and the body contains the answer. Migrate existing task questions before upgrading.
- Text and options can start directly under the title or after a blank `>` line.
- Note controls appear only when the question contains an explicit trailing nested `[!note]` callout.
- After a choice is selected, selected options are emphasized and unselected options are muted.

### Removed

- The old `- [ ] question` with a nested `[!answer]`, `[!answer|choice]`, or `[!answer|choices]` callout.
- The `mdast-util-gfm-task-list-item` and `micromark-extension-gfm-task-list-item` dependencies.

## [0.1.0] - 2026-10-26

### Added

- Initial release with reading-view text answers, single and multiple picks, custom Other answers, and notes stored as plain Markdown.

[Unreleased]: https://github.com/tyler-dot-earth/obsidian-tincan/compare/0.2.0...HEAD
[0.2.0]: https://github.com/tyler-dot-earth/obsidian-tincan/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/tyler-dot-earth/obsidian-tincan/releases/tag/0.1.0
