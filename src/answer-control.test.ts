// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'

import { assert, describe, it } from '@effect/vitest'

import { AnswerControl, type ControlActions } from '#/src/answer-control'
import { targetFor, writeAnswer } from '#/src/answer-target'
import { type Draft, Drafts } from '#/src/drafts'

const click = (element: HTMLElement, label: string): void => {
	const button = Array.from(element.querySelectorAll('button')).find(
		(candidate) => candidate.textContent === label,
	)

	assert.ok(button !== undefined, label)
	button.click()
}

const callout = (): HTMLDivElement => {
	const element = document.createElement('div')
	element.innerHTML = '<div class="callout-content"><p>Original rendered answer</p></div>'
	document.body.append(element)

	return element
}

/** Obsidian host boundary; controls, drafts, parsing, and replacement are real. */
class Note {
	source: string
	writes = 0
	popup: Draft | undefined
	readonly drafts = new Drafts<string>()
	readonly actions: ControlActions = {
		draft: (target) => this.drafts.get('note.md', target),
		save: (draft) => {
			this.source = writeAnswer(this.source, draft.target, draft.text)
			this.writes += 1
			draft.savedTarget = targetFor(this.source, draft.target.question, draft.target.field)
			draft.saved = true
			draft.editing = false
			draft.notify()

			return Promise.resolve(true)
		},
		modal: (draft) => {
			this.popup = draft
		},
	}

	constructor(source: string) {
		this.source = source
	}

	mount(
		element: HTMLElement,
		question: string,
		field: 'answer' | 'note' = 'answer',
	): AnswerControl {
		const draft = this.drafts.get('note.md', targetFor(this.source, question, field))
		const control = new AnswerControl(element, draft, this.actions)
		control.load()

		return control
	}
}

describe('reading-view answer controls', () => {
	it('offers Edit, prefills the saved text answer, and keeps Cancel and Resume draft local', () => {
		const source = readFileSync('fixtures/answers.md', 'utf8')
		const note = new Note(source)
		const element = callout()
		const control = note.mount(element, 'What should we do this weekend?')
		assert.strictEqual(note.drafts.pending().length, 0)
		click(element, 'Edit')
		const input = element.querySelector('textarea')
		assert.ok(input !== null)
		assert.strictEqual(input.value, 'A picnic in the park')
		input.value = 'A longer walk'
		input.dispatchEvent(new Event('input'))
		click(element, 'Cancel')
		assert.strictEqual(element.querySelector('p')?.textContent, 'Original rendered answer')
		assert.strictEqual(note.source, source)
		assert.strictEqual(note.writes, 0)
		click(element, 'Resume draft…')
		assert.strictEqual(element.querySelector('textarea')?.value, 'A longer walk')
		click(element, 'Open in popup')
		assert.strictEqual(note.popup?.text, 'A longer walk')
		control.unload()
		element.remove()
	})

	it('saves text once and allows another Edit with the newly saved answer prefilled', async () => {
		const note = new Note('- [ ] When?\n  > [!answer]\n  > Tomorrow\n')
		const element = callout()
		const control = note.mount(element, 'When?')
		click(element, 'Edit')
		const input = element.querySelector('textarea')
		assert.ok(input !== null)
		input.value = 'Friday'
		input.dispatchEvent(new Event('input'))
		click(element, 'Done')
		await Promise.resolve()
		assert.strictEqual(note.writes, 1)
		assert.strictEqual(note.source, '- [ ] When?\n  > [!answer]\n  > Friday\n')
		click(element, 'Edit')
		assert.strictEqual(element.querySelector('textarea')?.value, 'Friday')
		click(element, 'Cancel')
		assert.strictEqual(element.querySelector('.answer-saved')?.textContent, 'Friday')
		control.unload()
		element.remove()
	})
	it('fills and edits an explicit empty note, including on completed questions', async () => {
		const note = new Note('- [x] Revisit?\n\n  > [!answer]\n  >\n  > > [!note]\n  > >\n')
		const element = callout()
		const control = note.mount(element, 'Revisit?', 'note')
		assert.strictEqual(element.classList.contains('answer-side-note'), true)
		assert.strictEqual(element.classList.contains('answer-answered'), false)
		click(element, 'Add note')
		const textarea = element.querySelector('textarea')
		assert.ok(textarea !== null)
		textarea.value = 'Leaning A; ask after Friday'
		textarea.dispatchEvent(new Event('input'))
		click(element, 'Done')
		await Promise.resolve()
		assert.strictEqual(note.writes, 1)
		assert.strictEqual(
			note.source,
			'- [x] Revisit?\n\n  > [!answer]\n  >\n  > > [!note]\n  > > Leaning A; ask after Friday\n',
		)
		click(element, 'Edit note')
		assert.strictEqual(element.querySelector('textarea')?.value, 'Leaning A; ask after Friday')
		control.unload()
		element.remove()
	})
})
