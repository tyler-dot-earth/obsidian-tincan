// @vitest-environment happy-dom
import { assert, describe, it } from '@effect/vitest'
import { Effect } from 'effect'

import { applyAppearance } from '#/src/answer-appearance'
import type { ControlActions } from '#/src/answer-control'
import { targetFor } from '#/src/answer-target'
import { Drafts } from '#/src/drafts'
import { questionBlocks } from '#/src/question-blocks'
import { QuestionControl } from '#/src/question-control'
import { saveAnswer } from '#/src/save-answer'

const click = (root: HTMLElement, text: string): void => {
	const button = Array.from(root.querySelectorAll('button')).find(
		(candidate) => candidate.textContent === text,
	)

	assert.ok(button !== undefined, text)
	button.click()
}

interface MountedQuestion {
	readonly root: HTMLElement
	readonly box: HTMLElement
	readonly control: QuestionControl
}

/** The vault and Obsidian-rendered HTML are boundaries; every internal collaborator is real. */
class Note {
	source: string
	writes = 0
	lastSave = Promise.resolve(false)
	readonly drafts = new Drafts<string>()

	constructor(source: string) {
		this.source = source
	}

	mount(html: string): MountedQuestion {
		const root = document.createElement('div')
		root.innerHTML = html
		document.body.append(root)
		const box = root.querySelector<HTMLElement>('.callout')
		assert.ok(box !== null)
		const block = questionBlocks(this.source)[0]
		assert.ok(block !== undefined)

		const actions: ControlActions = {
			draft: (target) => this.drafts.get('note.md', target),
			save: (draft) => {
				draft.saving = true
				draft.notify()
				this.lastSave = Effect.runPromise(
					saveAnswer(
						{
							available: () => true,
							editing: () => false,
							process: (transform) =>
								new Promise<string>((resolve) => {
									this.source = transform(this.source)
									this.writes += 1
									resolve(this.source)
								}),
						},
						draft.target,
						draft.text,
					).pipe(
						Effect.match({
							onSuccess: (source) => {
								draft.savedTarget = targetFor(source, draft.target.question, draft.target.field)

								return true
							},
							onFailure: () => false,
						}),
					),
				).then((saved) => {
					draft.saving = false
					draft.saved = saved
					draft.notify()

					return saved
				})

				return this.lastSave
			},
			modal: () => {},
			state: (target) => applyAppearance(box, 'answer', target.answer?.content),
		}

		const control = new QuestionControl(box, block, actions)
		control.load()

		return { root, box, control }
	}
}

const outer = (body: string): string =>
	`<div class="callout" data-callout="question"><div class="callout-title"><div class="callout-title-inner">Q?</div></div><div class="callout-content">${body}</div></div>`

const nativeNote =
	'<div class="callout" data-callout="note"><div class="callout-content">Ask Friday</div></div>'

describe('one compact question box', () => {
	it('edits a title-question answer without changing its title or explicit note', async () => {
		const source = '> [!question] Q?\n> Plan\n>\n> > [!note]\n> > Ask Friday\n'
		const note = new Note(source)

		const html = outer('<p>Plan</p>' + nativeNote)

		const { root, box, control } = note.mount(html)
		click(box, 'Edit')
		const textarea = box.querySelector<HTMLTextAreaElement>('.answer-body textarea')
		assert.ok(textarea !== null)
		assert.strictEqual(textarea.value, 'Plan')
		textarea.value = 'A better plan'
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		click(box, 'Done')
		await note.lastSave
		assert.strictEqual(note.writes, 1)
		assert.strictEqual(note.source, source.replace('> Plan', '> A better plan'))
		assert.strictEqual(box.querySelector('.callout-title-inner')?.textContent, 'Q?')
		assert.strictEqual(box.querySelector('.answer-note-text')?.textContent, 'Ask Friday')
		click(box, 'Edit note')
		assert.strictEqual(
			box.querySelector<HTMLTextAreaElement>('.answer-note textarea')?.value,
			'Ask Friday',
		)
		control.unload()
		root.remove()
	})

	it.each([
		['text', 'direct'],
		['text', 'separated'],
		['choice', 'direct'],
		['choice', 'separated'],
		['choices', 'direct'],
		['choices', 'separated'],
	] as const)('parses and renders %s with %s body lines', (kind, layout) => {
		const gap = layout === 'separated' ? '>\n' : ''
		const metadata = kind === 'text' ? '' : '|' + kind
		const body = kind === 'text' ? '> Tomorrow\n' : '> - [ ] River\n> - [ ] Park\n'
		const source = `> [!question${metadata}] Q?\n${gap}${body}>\n> > [!note]\n> > Ask Friday\n`
		const block = questionBlocks(source)[0]
		assert.ok(block !== undefined)
		assert.deepStrictEqual(
			block.slots[0].content,
			kind === 'text'
				? { kind, text: layout === 'separated' ? '\nTomorrow' : 'Tomorrow' }
				: {
						kind,
						options: [
							{ label: 'River', checked: false },
							{ label: 'Park', checked: false },
						],
						other: '',
					},
		)

		const note = new Note(source)
		const html = kind === 'text' ? '<p>Tomorrow</p>' : '<ul><li>River</li><li>Park</li></ul>'
		const { root, box, control } = note.mount(outer(html + nativeNote))
		assert.strictEqual(box.querySelector('.callout-title-inner')?.textContent, 'Q?')
		assert.strictEqual(box.querySelector('.answer-note-text')?.textContent, 'Ask Friday')

		if (kind === 'text') {
			click(box, 'Edit')
			assert.strictEqual(
				box.querySelector<HTMLTextAreaElement>('.answer-body textarea')?.value,
				layout === 'separated' ? '\nTomorrow' : 'Tomorrow',
			)
		} else {
			assert.deepStrictEqual(
				Array.from(box.querySelectorAll<HTMLInputElement>('.answer-option input')).map(
					(input) => input.checked,
				),
				[false, false],
			)
			assert.strictEqual(
				box.querySelector('.answer-kind')?.textContent,
				kind === 'choice' ? 'pick 1' : 'pick 1+',
			)
			assert.strictEqual(box.querySelector('.answer-other-row label')?.textContent, 'Other')
		}

		assert.strictEqual(note.writes, 0)
		assert.strictEqual(note.source, source)
		control.unload()
		root.remove()
	})

	it.each(['', '>\n'])('does not offer note controls without explicit note syntax: %s', (body) => {
		const source = '> [!question] Q?\n' + body
		const note = new Note(source)
		const { root, box, control } = note.mount(outer(''))
		assert.strictEqual(box.querySelector('.answer-note'), null)
		assert.ok(!box.textContent?.includes('Add note'))
		assert.strictEqual(note.writes, 0)
		assert.strictEqual(note.source, source)
		control.unload()
		root.remove()
	})

	it('offers Add note only for an explicit empty nested note', () => {
		const note = new Note('> [!question] Q?\n>\n> > [!note]\n> >\n')
		const { root, box, control } = note.mount(outer(''))
		assert.strictEqual(box.querySelectorAll('.answer-note').length, 1)
		click(box, 'Add note')
		assert.strictEqual(box.querySelector<HTMLTextAreaElement>('.answer-note textarea')?.value, '')
		assert.strictEqual(note.writes, 0)
		control.unload()
		root.remove()
	})

	it('renders a single suggestion and Other, saves once per click, and stays editable after redraw', async () => {
		const source = '> [!question|choice] Q?\n> - [ ] 🤖 After lunch\n'
		const note = new Note(source)
		const { root, box, control } = note.mount(outer('<p>🤖 After lunch</p>'))
		assert.strictEqual(box.classList.contains('answer-unanswered'), true)
		assert.strictEqual(box.querySelectorAll('.answer-option').length, 1)
		assert.strictEqual((box.textContent?.match(/🤖 After lunch/g) ?? []).length, 1)
		assert.strictEqual(box.querySelector('.callout-title .answer-kind')?.textContent, 'pick 1')
		assert.strictEqual(box.querySelector('.answer-other-row label')?.textContent, 'Other')
		assert.strictEqual(
			Array.from(box.querySelectorAll('button')).some((button) =>
				['Answer…', 'Use this'].includes(button.textContent ?? ''),
			),
			false,
		)
		assert.strictEqual(note.writes, 0)
		assert.strictEqual(note.source, source)
		const input = box.querySelector<HTMLInputElement>('.answer-option input')
		assert.ok(input !== null)
		input.click()
		await note.lastSave
		assert.strictEqual(note.writes, 1)
		assert.strictEqual(note.source, source.replace('[ ] 🤖', '[x] 🤖'))
		assert.strictEqual(box.classList.contains('answer-answered'), true)
		assert.strictEqual(input.checked, true)
		control.unload()
		root.remove()
		const redrawn = note.mount(outer('<p>🤖 After lunch</p>'))
		const selected = redrawn.box.querySelector<HTMLInputElement>('.answer-option input')
		assert.ok(selected !== null && selected.checked)
		selected.click()
		await note.lastSave
		assert.strictEqual(note.writes, 2)
		assert.strictEqual(note.source, source)
		assert.strictEqual(redrawn.box.classList.contains('answer-unanswered'), true)
		redrawn.control.unload()
		redrawn.root.remove()
	})

	it('opens Other beside a suggestion, keeps Cancel local, and saves custom text without changing the note', async () => {
		const source =
			'> [!question|choice] Q?\n> - [ ] 🤖 After lunch\n>\n> > [!note]\n> > Ask Friday\n'

		const note = new Note(source)
		const { root, box, control } = note.mount(outer('<p>🤖 After lunch</p>' + nativeNote))
		box.querySelector<HTMLInputElement>('.answer-other-toggle')?.click()
		assert.strictEqual(box.querySelector<HTMLTextAreaElement>('.answer-body textarea')?.value, '')
		click(box, 'Cancel')
		assert.strictEqual(note.writes, 0)
		assert.strictEqual(note.source, source)
		assert.strictEqual(box.querySelectorAll('.answer-option').length, 1)
		box.querySelector<HTMLInputElement>('.answer-other-toggle')?.click()
		const textarea = box.querySelector<HTMLTextAreaElement>('.answer-body textarea')
		assert.ok(textarea !== null)
		textarea.value = 'Before dinner'
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		click(box, 'Save')
		await note.lastSave
		assert.strictEqual(note.writes, 1)
		assert.strictEqual(
			note.source,
			source.replace('> > [!note]', '> Other: Before dinner\n>\n> > [!note]'),
		)
		assert.strictEqual(box.querySelector<HTMLInputElement>('.answer-option input')?.checked, false)
		assert.strictEqual(box.querySelector<HTMLInputElement>('.answer-other-toggle')?.checked, true)
		assert.strictEqual(box.querySelector<HTMLElement>('.answer-other-editor')?.hidden, true)
		click(box, 'Edit')
		assert.strictEqual(textarea.value, 'Before dinner')
		assert.strictEqual(box.querySelector('.answer-note-text')?.textContent, 'Ask Friday')
		assert.strictEqual(box.classList.contains('answer-answered'), true)
		control.unload()
		root.remove()
	})

	it('shows Other-only answers as selected, closes their editor, and puts the pick label in the title', () => {
		const note = new Note('> [!question|choice] Q?\n> - [ ] 🤖 A\n>\n> Other: My answer\n')

		const { root, box, control } = note.mount(outer('<ul><li>A</li></ul><p>Other: My answer</p>'))
		assert.strictEqual(box.querySelector('.callout-title .answer-kind')?.textContent, 'pick 1')
		assert.strictEqual(box.querySelector<HTMLInputElement>('.answer-option input')?.checked, false)
		assert.strictEqual(box.querySelector<HTMLInputElement>('.answer-other-toggle')?.checked, true)
		assert.strictEqual(box.querySelector<HTMLElement>('.answer-other-editor')?.hidden, true)
		assert.strictEqual(box.classList.contains('answer-answered'), true)
		assert.strictEqual(root.querySelectorAll('.callout').length, 1)
		assert.strictEqual(box.querySelector('.answer-note'), null)
		control.unload()
		root.remove()
	})

	it('folds a native nested note into the same box, keeps it distinct, and restores the original DOM on disposal', () => {
		const note = new Note('> [!question] Q?\n> Plan\n>\n> > [!note]\n> > Ask Friday\n')

		const { root, box, control } = note.mount(outer('<p>Plan</p>' + nativeNote))
		assert.strictEqual(root.querySelectorAll('.callout').length, 1)
		assert.strictEqual(box.querySelector('.answer-note-text')?.textContent, 'Ask Friday')
		assert.strictEqual(box.querySelector('.answer-note .callout-title'), null)
		click(box, 'Edit note')
		assert.strictEqual(
			box.querySelector<HTMLTextAreaElement>('.answer-note textarea')?.value,
			'Ask Friday',
		)
		control.unload()
		assert.strictEqual(root.querySelectorAll('.callout').length, 2)
		assert.strictEqual(
			root.querySelector('.callout[data-callout="note"]')?.hasAttribute('hidden'),
			false,
		)
		root.remove()
	})
})
