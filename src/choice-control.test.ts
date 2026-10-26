// @vitest-environment happy-dom
import { assert, describe, it } from '@effect/vitest'
import { Effect } from 'effect'

import { AnswerControl, type ControlActions } from '#/src/answer-control'
import { targetFor } from '#/src/answer-target'
import { type Draft, Drafts } from '#/src/drafts'
import { type AnswerWriter, saveAnswer } from '#/src/save-answer'

const sourceFor = (kind: string): string =>
	`Before\n\n- [ ] Which?\n  > [!answer|${kind}]\n  > - [ ] River\n  > - [ ] Park\n\nAfter\n`

interface MountedControl {
	readonly element: HTMLElement
	readonly control: AnswerControl
	readonly draft: Draft
}

/** Vault and plugin host boundary. Every click uses the real Effect writer and draft store. */
class Note implements AnswerWriter {
	source: string
	writes = 0
	processes = 0
	exists = true
	inEditor = false
	fail = false
	defer = false
	finish: (() => void) | undefined
	error = ''
	lastSave = Promise.resolve(false)
	readonly drafts = new Drafts<string>()
	available = (): boolean => this.exists
	editing = (): boolean => this.inEditor
	process = (transform: (source: string) => string): Promise<string> => {
		this.processes += 1

		return new Promise((resolve, reject) => {
			const apply = (): void => {
				try {
					if (this.fail) throw new Error('Read-only volume')
					this.source = transform(this.source)
					this.writes += 1
					resolve(this.source)
				} catch (error) {
					reject(error)
				}
			}

			if (this.defer) this.finish = apply
			else apply()
		})
	}

	readonly actions: ControlActions = {
		draft: (target) => this.drafts.get('note.md', target),
		save: (draft) => {
			draft.saving = true
			draft.notify()
			this.lastSave = Effect.runPromise(
				saveAnswer(this, draft.target, draft.text).pipe(
					Effect.match({
						onSuccess: (source) => {
							draft.savedTarget = targetFor(source, draft.target.question, draft.target.field)

							return true
						},
						onFailure: (error) => {
							this.error = error.message

							return false
						},
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
		modal: () => {
			throw new Error('Choices must not open a modal')
		},
	}

	constructor(source: string) {
		this.source = source
	}

	mount(): MountedControl {
		const element = document.createElement('div')
		element.innerHTML = '<div class="callout-content"><p>Original Markdown</p></div>'
		document.body.append(element)
		const draft = this.drafts.get('note.md', targetFor(this.source, 'Which?'))
		const control = new AnswerControl(element, draft, this.actions)
		control.load()

		return { element, control, draft }
	}
}

const input = (element: HTMLElement, index: number): HTMLInputElement => {
	const result = element.querySelectorAll<HTMLInputElement>('.answer-option input')[index]
	assert.ok(result !== undefined)

	return result
}

const picks = (element: HTMLElement): boolean[] =>
	Array.from(
		element.querySelectorAll<HTMLInputElement>('.answer-option input'),
		(entry) => entry.checked,
	)

const close = (mounted: ReturnType<Note['mount']>): void => {
	mounted.control.unload()
	mounted.element.remove()
}

describe('direct reading-view picks', () => {
	it.each(['choice', 'choices'])(
		'saves %s on a label click without Answer, Edit, or Done',
		async (kind) => {
			const note = new Note(sourceFor(kind))
			const mounted = note.mount()
			assert.strictEqual(note.writes, 0)
			assert.strictEqual(input(mounted.element, 0).disabled, false)
			assert.strictEqual(input(mounted.element, 0).type, 'checkbox')
			assert.ok(
				!Array.from(mounted.element.querySelectorAll('button')).some((button) =>
					['Answer…', 'Edit', 'Done'].includes(button.textContent ?? ''),
				),
			)
			mounted.element.querySelector('label')?.click()
			await note.lastSave
			assert.strictEqual(note.processes, 1)
			assert.strictEqual(note.writes, 1)
			assert.strictEqual(note.source, sourceFor(kind).replace('[ ] River', '[x] River'))
			assert.deepStrictEqual(picks(mounted.element), [true, false])
			close(mounted)
		},
	)

	it.each(['choice', 'choices'])(
		'rebases %s after every save and handles successive clicks',
		async (kind) => {
			const note = new Note(sourceFor(kind).replace('[ ] River', '[x] River'))
			const mounted = note.mount()
			input(mounted.element, 1).click()
			await note.lastSave
			assert.deepStrictEqual(picks(mounted.element), [kind === 'choices', true])
			assert.strictEqual(
				note.source,
				sourceFor(kind)
					.replace('[ ] River', kind === 'choices' ? '[x] River' : '[ ] River')
					.replace('[ ] Park', '[x] Park'),
			)
			input(mounted.element, 1).click()
			await note.lastSave
			assert.deepStrictEqual(picks(mounted.element), [kind === 'choices', false])
			assert.strictEqual(note.writes, 2)
			assert.strictEqual(note.error, '')
			close(mounted)
		},
	)

	it.each(['choice', 'choices'])('clears the sole %s pick in one write', async (kind) => {
		const note = new Note(sourceFor(kind).replace('[ ] River', '[x] River'))
		const mounted = note.mount()
		input(mounted.element, 0).click()
		await note.lastSave
		assert.strictEqual(note.writes, 1)
		assert.strictEqual(note.source, sourceFor(kind))
		assert.deepStrictEqual(picks(mounted.element), [false, false])
		close(mounted)
	})

	it('intercepts target and delegated native task handlers, with a single write for a touch sequence', async () => {
		const note = new Note(sourceFor('choices'))
		const mounted = note.mount()
		const checkbox = input(mounted.element, 0)
		let native = 0

		const nativeToggle = (): void => {
			native += 1
		}

		checkbox.addEventListener('click', nativeToggle)

		for (const name of [
			'click',
			'input',
			'change',
			'pointerdown',
			'pointerup',
			'touchstart',
			'touchend',
		])
			mounted.element.addEventListener(name, nativeToggle)

		for (const name of ['pointerdown', 'touchstart', 'pointerup', 'touchend'])
			checkbox.dispatchEvent(new Event(name, { bubbles: true, cancelable: true }))
		assert.strictEqual(note.writes, 0)
		checkbox.click()
		checkbox.dispatchEvent(new Event('input', { bubbles: true }))
		checkbox.dispatchEvent(new Event('change', { bubbles: true }))
		await note.lastSave
		assert.strictEqual(native, 0)
		assert.strictEqual(note.processes, 1)
		assert.strictEqual(note.writes, 1)
		assert.strictEqual(checkbox.checked, true)
		close(mounted)
	})

	it('blocks overlapping clicks until the pending Vault.process finishes', async () => {
		const note = new Note(sourceFor('choices'))
		note.defer = true
		const mounted = note.mount()
		input(mounted.element, 0).click()
		assert.strictEqual(input(mounted.element, 1).disabled, true)
		input(mounted.element, 1).dispatchEvent(
			new MouseEvent('click', { bubbles: true, cancelable: true }),
		)
		assert.strictEqual(note.processes, 1)
		note.finish?.()
		await note.lastSave
		assert.strictEqual(note.writes, 1)
		assert.deepStrictEqual(picks(mounted.element), [true, false])
		note.defer = false
		input(mounted.element, 1).click()
		await note.lastSave
		assert.strictEqual(note.writes, 2)
		assert.deepStrictEqual(picks(mounted.element), [true, true])
		close(mounted)
	})

	it.each([
		'answer',
		'options',
		'kind',
		'context',
		'duplicate',
		'completed',
		'deleted',
		'editable',
	])('refuses a %s change inside Vault.process and retains the attempted picks', async (change) => {
		const original = sourceFor('choices')
		const note = new Note(original)
		note.defer = true
		const mounted = note.mount()
		input(mounted.element, 0).click()

		const changes = new Map([
			['answer', original.replace('[ ] Park', '[x] Park')],
			['options', original.replace('River', 'Beach')],
			['kind', original.replace('|choices]', '|choice]')],
			['context', original.replace('Which?', 'Which?\n  New context')],
			['duplicate', original + '\n' + original],
			['completed', original.replace('[ ] Which?', '[x] Which?')],
		])

		note.source = changes.get(change) ?? original
		note.exists = change !== 'deleted'
		note.inEditor = change === 'editable'
		const current = note.source
		note.finish?.()
		await note.lastSave
		assert.strictEqual(note.writes, 0)
		assert.strictEqual(note.source, current)
		assert.ok(note.error.length > 0)
		assert.strictEqual(mounted.draft.text, '- [x] River\n- [ ] Park')
		assert.strictEqual(note.drafts.pending()[0]?.draft, mounted.draft)
		assert.match(mounted.element.querySelector('[role=status]')?.textContent ?? '', /Not saved/)
		assert.strictEqual(
			Array.from(mounted.element.querySelectorAll('button')).find(
				(button) => button.textContent === 'Retry',
			)?.hidden,
			false,
		)
		close(mounted)
	})

	it('keeps failed picks through redraw and retries them without an extra write', async () => {
		const note = new Note(sourceFor('choices'))
		note.fail = true
		const mounted = note.mount()
		input(mounted.element, 0).click()
		await note.lastSave
		assert.strictEqual(note.writes, 0)
		close(mounted)
		const remounted = note.mount()
		assert.deepStrictEqual(picks(remounted.element), [true, false])
		note.fail = false
		Array.from(remounted.element.querySelectorAll('button'))
			.find((button) => button.textContent === 'Retry')
			?.click()
		await note.lastSave
		assert.strictEqual(note.processes, 2)
		assert.strictEqual(note.writes, 1)
		assert.strictEqual(note.source, sourceFor('choices').replace('[ ] River', '[x] River'))
		assert.strictEqual(note.drafts.pending().length, 0)
		close(remounted)
	})

	it('updates another mounted copy and accepts its next pick against the saved baseline', async () => {
		const note = new Note(sourceFor('choices'))
		const first = note.mount()
		const second = note.mount()
		input(first.element, 0).click()
		await note.lastSave
		assert.deepStrictEqual(picks(second.element), [true, false])
		input(second.element, 1).click()
		await note.lastSave
		assert.strictEqual(note.writes, 2)
		assert.strictEqual(note.error, '')
		assert.deepStrictEqual(picks(first.element), [true, true])
		close(first)
		close(second)
	})

	it('labels multiple picks, styles recommendations and saves editable Other alongside a pick', async () => {
		const note = new Note(sourceFor('choices').replace('River', '🤖 River'))
		const mounted = note.mount()
		assert.strictEqual(mounted.element.querySelector('legend')?.textContent, 'pick 1+')
		assert.strictEqual(
			mounted.element.querySelector('.answer-recommended span')?.textContent,
			'🤖 River',
		)
		mounted.element.querySelector<HTMLInputElement>('.answer-other-toggle')?.click()
		const textarea = mounted.element.querySelector('textarea')
		assert.ok(textarea !== null)
		textarea.value = 'A picnic in the park'
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		assert.strictEqual(note.writes, 0)
		input(mounted.element, 0).click()
		await note.lastSave
		assert.strictEqual(note.writes, 1)
		assert.strictEqual(textarea.value, 'A picnic in the park')
		assert.ok(!note.source.includes('Other:'))
		Array.from(mounted.element.querySelectorAll('button'))
			.find((button) => button.textContent === 'Save')
			?.click()
		await note.lastSave
		assert.strictEqual(note.writes, 2)
		assert.match(note.source, /\[x\] 🤖 River/)
		assert.match(note.source, /Other: A picnic in the park/)
		assert.strictEqual(mounted.element.classList.contains('answer-answered'), true)
		textarea.value = ''
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		Array.from(mounted.element.querySelectorAll('button'))
			.find((button) => button.textContent === 'Save')
			?.click()
		await note.lastSave
		assert.ok(!note.source.includes('Other:'))
		assert.match(note.source, /\[x\] 🤖 River/)
		close(mounted)
	})

	it('switches a single pick from Other to an option and back in one write per action', async () => {
		const original = sourceFor('choice').replace(
			'  > - [ ] Park\n',
			'  > - [ ] Park\n  >\n  > Other: A picnic\n  >\n  > > [!note]\n  > > Ask Friday\n',
		)

		const note = new Note(original)
		const mounted = note.mount()
		const other = mounted.element.querySelector<HTMLInputElement>('.answer-other-toggle')
		assert.ok(other !== null && other.checked)

		input(mounted.element, 0).click()
		await note.lastSave
		assert.strictEqual(note.writes, 1)
		assert.deepStrictEqual(picks(mounted.element), [true, false])
		assert.strictEqual(other.checked, false)
		assert.ok(!note.source.includes('Other:'))
		assert.match(note.source, /Ask Friday/)
		assert.strictEqual(note.drafts.pending().length, 0)

		mounted.element.querySelector<HTMLInputElement>('.answer-other-toggle')?.click()
		await note.lastSave
		assert.strictEqual(note.writes, 2)
		assert.deepStrictEqual(picks(mounted.element), [false, false])
		const textarea = mounted.element.querySelector('textarea')
		assert.ok(textarea !== null)
		assert.strictEqual(textarea.value, '')
		textarea.value = 'Go by bus'
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		assert.strictEqual(note.writes, 2)
		assert.deepStrictEqual(picks(mounted.element), [false, false])
		mounted.element.querySelector<HTMLButtonElement>('.answer-other-save')?.click()
		await note.lastSave
		assert.strictEqual(note.writes, 3)
		assert.deepStrictEqual(picks(mounted.element), [false, false])
		assert.strictEqual(other.checked, true)
		assert.strictEqual(note.source, original.replace('A picnic', 'Go by bus'))
		close(mounted)
		const redrawn = note.mount()
		assert.deepStrictEqual(picks(redrawn.element), [false, false])
		assert.strictEqual(
			redrawn.element.querySelector<HTMLInputElement>('.answer-other-toggle')?.checked,
			true,
		)
		close(redrawn)
	})

	it.each(['choice', 'choices'])(
		'ticking empty Other immediately clears a single pick but preserves multiple picks: %s',
		async (kind) => {
			const source = sourceFor(kind).replace('[ ] River', '[x] River')
			const note = new Note(source)
			const mounted = note.mount()
			const other = mounted.element.querySelector<HTMLInputElement>('.answer-other-toggle')
			assert.ok(other !== null)
			other.click()
			await note.lastSave
			assert.strictEqual(note.writes, kind === 'choice' ? 1 : 0)
			assert.strictEqual(note.source, kind === 'choice' ? sourceFor(kind) : source)
			assert.deepStrictEqual(picks(mounted.element), [kind === 'choices', false])
			assert.strictEqual(
				mounted.element.querySelector<HTMLElement>('.answer-other-editor')?.hidden,
				false,
			)
			const textarea = mounted.element.querySelector('textarea')
			assert.ok(textarea !== null)
			assert.strictEqual(textarea.value, '')
			textarea.value = 'Custom route'
			textarea.dispatchEvent(new Event('input', { bubbles: true }))
			mounted.element.querySelector<HTMLButtonElement>('.answer-other-save')?.click()
			await note.lastSave
			assert.strictEqual(note.writes, kind === 'choice' ? 2 : 1)
			assert.deepStrictEqual(picks(mounted.element), [kind === 'choices', false])
			assert.strictEqual(other.checked, true)
			assert.match(note.source, /Other: Custom route/)
			close(mounted)
		},
	)

	it('keeps an unsaved Other draft when ticking its checkbox clears a single pick', async () => {
		const note = new Note(sourceFor('choice'))
		const mounted = note.mount()
		mounted.element.querySelector<HTMLInputElement>('.answer-other-toggle')?.click()
		const textarea = mounted.element.querySelector('textarea')
		assert.ok(textarea !== null)
		textarea.value = 'Resume this route'
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		mounted.element.querySelector<HTMLButtonElement>('.answer-other-cancel')?.click()
		input(mounted.element, 0).click()
		await note.lastSave
		assert.strictEqual(note.writes, 1)
		assert.deepStrictEqual(picks(mounted.element), [true, false])
		mounted.element.querySelector<HTMLInputElement>('.answer-other-toggle')?.click()
		await note.lastSave
		assert.strictEqual(note.writes, 2)
		assert.strictEqual(note.source, sourceFor('choice'))
		assert.strictEqual(textarea.value, 'Resume this route')
		assert.strictEqual(
			mounted.element.querySelector<HTMLElement>('.answer-other-editor')?.hidden,
			false,
		)
		close(mounted)
	})

	it('retains an exclusive Other draft after a refused save and retries against the original option', async () => {
		const source = sourceFor('choice').replace('[ ] River', '[x] River')
		const note = new Note(source)
		const mounted = note.mount()
		note.fail = true
		mounted.element.querySelector<HTMLInputElement>('.answer-other-toggle')?.click()
		await note.lastSave
		const textarea = mounted.element.querySelector('textarea')
		assert.ok(textarea !== null)
		textarea.value = 'Custom route'
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		mounted.element.querySelector<HTMLButtonElement>('.answer-other-save')?.click()
		await note.lastSave
		assert.strictEqual(note.writes, 0)
		assert.strictEqual(note.source, source)
		assert.strictEqual(textarea.value, 'Custom route')
		assert.ok(note.error.length > 0)
		note.fail = false
		Array.from(mounted.element.querySelectorAll('button'))
			.find((button) => button.textContent === 'Retry')
			?.click()
		await note.lastSave
		assert.strictEqual(note.writes, 1)
		assert.deepStrictEqual(picks(mounted.element), [false, false])
		assert.match(note.source, /Other: Custom route/)
		close(mounted)
	})

	it('restores unsaved Other across redraws and refuses changes beneath its original snapshot', async () => {
		const note = new Note(sourceFor('choices'))
		const mounted = note.mount()
		assert.strictEqual(mounted.element.querySelector('legend')?.textContent, 'pick 1+')
		mounted.element.querySelector<HTMLInputElement>('.answer-other-toggle')?.click()
		const textarea = mounted.element.querySelector('textarea')
		assert.ok(textarea !== null)
		textarea.value = 'Custom answer'
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		close(mounted)
		assert.strictEqual(note.drafts.pending().length, 1)
		const replacement = note.mount()
		assert.strictEqual(replacement.element.querySelector('textarea')?.value, 'Custom answer')
		note.source = note.source.replace('[ ] Park', '[x] Park')
		Array.from(replacement.element.querySelectorAll('button'))
			.find((button) => button.textContent === 'Save')
			?.click()
		await note.lastSave
		assert.strictEqual(note.writes, 0)
		assert.ok(!note.source.includes('Other:'))
		assert.strictEqual(note.drafts.pending().length, 1)
		close(replacement)
	})

	it('does not replace a pending pick payload with an overlapping Save other click', async () => {
		const note = new Note(sourceFor('choice'))
		note.defer = true
		const mounted = note.mount()
		mounted.element.querySelector<HTMLInputElement>('.answer-other-toggle')?.click()
		const textarea = mounted.element.querySelector('textarea')
		assert.ok(textarea !== null)
		textarea.value = 'Keep this unsaved custom text'
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		input(mounted.element, 0).click()

		const button = Array.from(mounted.element.querySelectorAll('button')).find(
			(candidate) => candidate.textContent === 'Save',
		)

		assert.ok(button !== undefined)
		button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
		assert.strictEqual(mounted.draft.text, '- [x] River\n- [ ] Park')
		assert.strictEqual(note.processes, 1)
		note.finish?.()
		await note.lastSave
		assert.ok(!note.source.includes('Other:'))
		assert.strictEqual(textarea.value, 'Keep this unsaved custom text')
		close(mounted)
	})

	it('collapses a saved Other answer, checks its row, and clears it in one safe click', async () => {
		const note = new Note(
			sourceFor('choice').replace(
				'  > - [ ] Park\n',
				'  > - [ ] Park\n  >\n  > Other: My own answer\n',
			),
		)

		const mounted = note.mount()
		const checkbox = mounted.element.querySelector<HTMLInputElement>('.answer-other-toggle')
		const editor = mounted.element.querySelector<HTMLElement>('.answer-other-editor')
		assert.ok(checkbox !== null && editor !== null)
		assert.strictEqual(checkbox.checked, true)
		assert.strictEqual(editor.hidden, true)
		const edit = mounted.element.querySelector<HTMLButtonElement>('.answer-other-edit')
		assert.ok(edit !== null)
		assert.strictEqual(edit.textContent, 'Edit')
		edit.click()
		assert.strictEqual(editor.hidden, false)
		const textarea = mounted.element.querySelector('textarea')
		assert.ok(textarea !== null)
		assert.strictEqual(textarea.value, 'My own answer')
		textarea.value = 'A better answer'
		textarea.dispatchEvent(new Event('input', { bubbles: true }))
		mounted.element.querySelector<HTMLButtonElement>('.answer-other-save')?.click()
		await note.lastSave
		assert.strictEqual(editor.hidden, true)
		assert.strictEqual(checkbox.checked, true)
		assert.match(note.source, /Other: A better answer/)
		checkbox.click()
		await note.lastSave
		assert.strictEqual(note.writes, 2)
		assert.strictEqual(checkbox.checked, false)
		assert.ok(!note.source.includes('Other:'))
		assert.strictEqual(mounted.element.querySelector('.answer-other-row button'), null)
		assert.strictEqual(mounted.element.classList.contains('answer-unanswered'), true)
		close(mounted)
	})

	it.each(['choice', 'choices'])(
		'opens and resumes unanswered %s Other through its checkbox without a button',
		(kind) => {
			const note = new Note(sourceFor(kind))
			const mounted = note.mount()
			assert.strictEqual(mounted.element.querySelector('.answer-other-row button'), null)
			assert.ok(!mounted.element.textContent?.includes('Other…'))
			mounted.element.querySelector<HTMLInputElement>('.answer-other-toggle')?.click()
			const editor = mounted.element.querySelector<HTMLElement>('.answer-other-editor')
			assert.strictEqual(editor?.hidden, false)
			const textarea = mounted.element.querySelector('textarea')
			assert.ok(textarea !== null)
			textarea.value = 'Remember this draft'
			textarea.dispatchEvent(new Event('input', { bubbles: true }))
			mounted.element.querySelector<HTMLButtonElement>('.answer-other-cancel')?.click()
			assert.strictEqual(editor?.hidden, true)
			assert.strictEqual(note.writes, 0)
			assert.strictEqual(note.source, sourceFor(kind))
			assert.strictEqual(note.drafts.pending().length, 1)
			assert.strictEqual(mounted.element.querySelector('.answer-other-row button'), null)
			close(mounted)
			const redrawn = note.mount()
			assert.strictEqual(redrawn.element.querySelector('.answer-other-row button'), null)
			redrawn.element.querySelector<HTMLInputElement>('.answer-other-toggle')?.click()
			assert.strictEqual(redrawn.element.querySelector('textarea')?.value, 'Remember this draft')
			assert.strictEqual(
				redrawn.element.querySelector<HTMLElement>('.answer-other-editor')?.hidden,
				false,
			)
			assert.strictEqual(note.writes, 0)
			close(redrawn)
		},
	)

	it('finishes a pending save after disposal without reattaching controls or writing twice', async () => {
		const note = new Note(sourceFor('choice'))
		note.defer = true
		const mounted = note.mount()
		input(mounted.element, 1).click()
		mounted.control.unload()
		note.finish?.()
		await note.lastSave
		assert.strictEqual(note.writes, 1)
		assert.strictEqual(mounted.element.querySelector('fieldset'), null)
		assert.strictEqual(mounted.element.querySelector('p')?.textContent, 'Original Markdown')
		mounted.element.remove()
	})
})
