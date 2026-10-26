// @vitest-environment happy-dom
import { assert, describe, it } from '@effect/vitest'

import { mountEditor } from '#/src/answer-editor'
import { targetFor } from '#/src/answer-target'
import { Drafts } from '#/src/drafts'

const target = targetFor('- [ ] Which day?\n  > [!answer]\n', 'Which day?')

const container = (): HTMLDivElement => {
	const element = document.createElement('div')
	document.body.append(element)

	return element
}

const input = (element: HTMLElement, text: string): HTMLTextAreaElement => {
	const textarea = element.querySelector('textarea')
	assert.ok(textarea !== null)
	textarea.value = text
	textarea.dispatchEvent(new Event('input', { bubbles: true }))

	return textarea
}

const click = (element: HTMLElement, text: string): void => {
	const button = Array.from(element.querySelectorAll('button')).find(
		(candidate) => candidate.textContent === text,
	)

	assert.ok(button !== undefined)
	button.click()
}

describe('draft lifecycle', () => {
	it('restores text and selection after removing the entire rendered section', () => {
		const file = { path: 'original.md' }
		const drafts = new Drafts<typeof file>()
		const draft = drafts.get(file, target)
		draft.editing = true
		draft.wantsFocus = true
		const first = container()
		let saves = 0

		const actions = {
			save: (): Promise<boolean> => {
				saves += 1

				return Promise.resolve(true)
			},
			modal: undefined,
			done: (): void => {},
		}

		const dispose = mountEditor(first, draft, actions)
		const textarea = input(first, 'A draft\n\n- With a list')
		textarea.setSelectionRange(3, 7)
		textarea.dispatchEvent(new Event('select'))
		first.remove()
		dispose()
		const second = container()
		const remounted = drafts.get(file, target)
		const cleanup = mountEditor(second, remounted, actions)
		const restored = second.querySelector('textarea')
		assert.strictEqual(restored?.value, 'A draft\n\n- With a list')
		assert.strictEqual(restored?.selectionStart, 3)
		assert.strictEqual(restored?.selectionEnd, 7)
		assert.strictEqual(saves, 0)
		assert.strictEqual(drafts.pending()[0]?.file, file)
		cleanup()
		second.remove()
	})

	it('keeps drafts tied to the original file through switches, renames, and changed contexts', () => {
		const drafts = new Drafts<{ path: string }>()
		const original = { path: 'original.md' }
		const draft = drafts.get(original, target)
		draft.text = 'Keep this'
		original.path = 'renamed.md'
		const other = drafts.get({ path: 'other.md' }, target)

		const changed = drafts.get(original, {
			...target,
			context: '- [ ] Which day?\n  - New context',
		})

		assert.strictEqual(other.text, '')
		assert.strictEqual(changed.text, '')
		assert.strictEqual(drafts.get(original, target).text, 'Keep this')
		assert.strictEqual(drafts.pending()[0]?.file.path, 'renamed.md')
	})

	it('keeps a failed save open and the text available for retry or copying', async () => {
		const element = container()
		const draft = new Drafts<string>().get('note.md', target)
		let closed = false

		const cleanup = mountEditor(element, draft, {
			save: () => Promise.resolve(false),
			modal: undefined,
			done: () => {
				closed = true
			},
		})

		input(element, 'Keep me after failure')
		click(element, 'Done')
		await Promise.resolve()
		assert.strictEqual(closed, false)
		assert.strictEqual(element.querySelector('textarea')?.value, 'Keep me after failure')
		assert.strictEqual(draft.text, 'Keep me after failure')
		cleanup()
		element.remove()
	})

	it('Cancel and popup transfer preserve the draft without saving', () => {
		const element = container()
		const draft = new Drafts<string>().get('note.md', target)
		let saves = 0
		let popupText = ''

		const cleanup = mountEditor(element, draft, {
			save: () => {
				saves += 1

				return Promise.resolve(true)
			},
			modal: () => {
				popupText = draft.text
			},
			done: () => {},
		})

		input(element, 'A long answer')
		click(element, 'Open in popup')
		click(element, 'Cancel')
		assert.strictEqual(popupText, 'A long answer')
		assert.strictEqual(draft.text, 'A long answer')
		assert.strictEqual(draft.editing, false)
		assert.strictEqual(saves, 0)
		cleanup()
		element.remove()
	})

	it('updates another mounted editor and does not bubble clicks to the note', () => {
		const drafts = new Drafts<string>()
		const draft = drafts.get('note.md', target)
		const first = container()
		const second = container()
		const actions = { save: () => Promise.resolve(true), modal: undefined, done: () => {} }
		const cleanFirst = mountEditor(first, draft, actions)
		const cleanSecond = mountEditor(second, draft, actions)
		let bubbled = false

		const listener = (): void => {
			bubbled = true
		}

		document.body.addEventListener('click', listener)
		input(first, 'Shared draft')
		first.querySelector('textarea')?.click()
		assert.strictEqual(second.querySelector('textarea')?.value, 'Shared draft')
		assert.strictEqual(bubbled, false)
		document.body.removeEventListener('click', listener)
		cleanFirst()
		cleanSecond()
		first.remove()
		second.remove()
	})
})
