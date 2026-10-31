import { answerContent, answerText, isAnswered, type AnswerContent } from '#/src/answer-content'
import type { AnswerTarget } from '#/src/answer-target'
import type { Draft } from '#/src/drafts'
import { OtherControl } from '#/src/other-control'

const activationEvents = [
	'click',
	'input',
	'change',
	'pointerdown',
	'pointerup',
	'touchstart',
	'touchend',
	'keydown',
	'dblclick',
]

export interface ChoiceActions {
	readonly draft: (target: AnswerTarget) => Draft
	readonly save: (draft: Draft) => Promise<boolean>
	readonly renderIcon?: ((element: HTMLElement, icon: string) => void) | undefined
	readonly addNote?: (() => void) | undefined
	readonly state?: (target: AnswerTarget) => void
}

/** Own inputs omit Obsidian's task classes/data-line; capture also blocks native handlers. */
export class ChoiceControl {
	private draft: Draft
	private readonly actions: ChoiceActions
	private readonly group: HTMLElement
	private readonly hint: HTMLElement
	private readonly list: HTMLUListElement
	private readonly inputs: HTMLInputElement[] = []
	private readonly feedback: HTMLElement
	private readonly status: HTMLElement
	private readonly retry: HTMLButtonElement
	private readonly other: OtherControl
	private unsubscribe: (() => void) | undefined
	private busy = false
	private active = true
	private readonly onEvent = (event: Event): void => this.intercept(event)

	constructor(container: HTMLElement, draft: Draft, actions: ChoiceActions) {
		this.draft = draft
		this.actions = actions
		const document = container.ownerDocument
		this.group = container
		this.group.classList.add('answer-choices')
		this.group.setAttribute('role', 'group')
		const instruction = draft.target.answer?.content?.kind === 'choice' ? 'pick 1' : 'pick 1+'
		this.group.setAttribute('aria-label', instruction)
		this.hint = document.createElement('li')
		this.hint.className = 'answer-choice-item answer-instruction'
		this.hint.setAttribute('role', 'presentation')
		const hintText = document.createElement('span')
		hintText.className = 'answer-kind'
		hintText.textContent = instruction
		this.hint.append(hintText)
		const list = document.createElement('ul')
		list.className = 'answer-choice-list'
		this.list = list
		list.append(this.hint)
		this.group.append(list)
		this.addOptions(list)
		this.other = new OtherControl(this.group, {
			draft: (): Draft => this.draft,
			save: (text): void => this.commitOther(text),
			busy: (): boolean => this.busy || this.draft.saving,
			addNote: this.actions.addNote,
			renderIcon: this.actions.renderIcon,
		})
		this.feedback = document.createElement('div')
		this.feedback.className = 'answer-save-feedback'
		this.status = document.createElement('span')
		this.status.setAttribute('role', 'status')
		this.retry = document.createElement('button')
		this.retry.type = 'button'
		this.retry.textContent = 'Retry'
		this.retry.className = 'answer-link'
		this.feedback.append(this.status, this.retry)
		this.group.append(this.feedback)

		// Pointer/touch defaults remain intact: the synthesized click is the sole write trigger.
		for (const name of activationEvents) this.group.addEventListener(name, this.onEvent, true)
		this.watch()
		this.refresh()

		if (draft.wantsFocus) this.inputs[draft.focusedOption]?.focus({ preventScroll: true })
	}

	private addOptions(list: HTMLUListElement): void {
		const content = this.draft.target.answer?.content

		if (content === undefined || content.kind === 'text') return

		for (const [index, option] of content.options.entries()) {
			const item = list.ownerDocument.createElement('li')
			item.className = 'answer-choice-item'
			const label = list.ownerDocument.createElement('label')
			const input = this.group.ownerDocument.createElement('input')
			input.type = 'checkbox'
			const text = this.group.ownerDocument.createElement('span')
			text.textContent = option.label
			label.className = 'answer-option'
			label.classList.toggle('answer-recommended', option.label.startsWith('🤖'))
			label.append(input, text)
			item.append(label)
			list.append(item)
			this.inputs.push(input)
			input.addEventListener('focus', () => {
				this.draft.focusedOption = index
				this.draft.wantsFocus = true
			})
		}
	}

	private intercept(event: Event): void {
		if (event.target instanceof Element && event.target.closest('.answer-note') !== null) return
		event.stopImmediatePropagation()

		if (this.other.handle(event)) return

		if (event.type !== 'click') return

		if (event.target === this.retry) {
			this.save()

			return
		}

		const path = event.composedPath()

		const index = this.inputs.findIndex(
			(input) => input.parentElement !== null && path.includes(input.parentElement),
		)

		if (index < 0) return
		event.preventDefault()
		this.toggle(index)
	}

	private toggle(index: number): void {
		if (this.busy || this.draft.saving) return
		const content = this.content()

		if (content === undefined) return
		const checked = content.options[index]?.checked !== true

		const options = content.options.map((option, position) => ({
			label: option.label,
			checked: position === index ? checked : content.kind === 'choices' && option.checked,
		}))

		const updated = { ...content, options }

		if (content.kind === 'choice' && checked) {
			updated.other = ''
			this.clearSavedOther(content.other)
		}

		this.draft.text = answerText(updated)
		this.save()
	}

	private clearSavedOther(saved: string | undefined): void {
		if (this.draft.otherText === (saved ?? '')) this.draft.otherText = ''
	}

	private commitOther(text: string): void {
		if (this.busy || this.draft.saving) return
		const content = this.content()

		if (content === undefined) return
		this.draft.otherText = text.replace(/\r\n|\r/g, '\n').trimEnd()

		const options = content.options.map((option) => ({
			...option,
			checked: (this.draft.otherText.trim() === '' || content.kind === 'choices') && option.checked,
		}))

		this.draft.text = answerText({ ...content, options, other: this.draft.otherText })
		this.save()
	}

	private content(): Exclude<AnswerContent, { readonly kind: 'text' }> | undefined {
		const kind = this.draft.target.answer?.content?.kind

		if (kind === undefined || kind === 'text') return undefined
		const content = answerContent(kind, this.draft.text)

		return content?.kind === 'text' ? undefined : content
	}

	private watch(): void {
		this.unsubscribe?.()
		this.unsubscribe = this.draft.subscribe(() => this.refresh())
	}

	private refresh(): void {
		if (!this.active) return
		this.rebase()
		const content = this.content()

		if (content === undefined) return
		const disabled = this.busy || this.draft.saving
		this.group.classList.toggle('answer-has-selection', isAnswered(content))

		for (const [index, input] of this.inputs.entries()) {
			input.checked = content.options[index]?.checked === true
			input.disabled = disabled
		}

		this.other.refresh(disabled)
		this.actions.state?.(this.draft.target)
		this.refreshStatus(disabled)
	}

	private rebase(): void {
		const saved = this.draft.savedTarget

		if (this.draft.saved && saved !== undefined) {
			const unsavedOther = this.draft.otherText
			const editing = this.draft.otherEditing
			const carry = this.hasOtherDraft()
			this.draft = this.actions.draft(saved)

			if (carry) {
				this.draft.otherText = unsavedOther
				this.draft.otherEditing = editing
			}

			this.watch()
		}
	}

	private hasOtherDraft(): boolean {
		const content = this.content()

		return (
			this.draft.otherText !== (content?.other ?? '') ||
			(this.draft.otherEditing && content?.other === '')
		)
	}

	private refreshStatus(disabled: boolean): void {
		const pending = this.draft.text !== this.draft.initialText
		this.feedback.hidden = !pending || disabled
		this.status.textContent =
			pending && !disabled ? 'Not saved. ' + (this.draft.saveError ?? 'Your picks are kept.') : ''
		this.retry.hidden = !pending || disabled
	}

	private save(): void {
		if (this.busy || this.draft.saving) return
		this.busy = true
		this.draft.notify()

		const settled = (): void => {
			this.busy = false
			this.refresh()
		}

		void this.actions.save(this.draft).then(settled, settled)
		// A cancelled checkbox click rolls back native pre-activation after dispatch.
		queueMicrotask(() => this.refresh())
	}

	unload(): void {
		this.active = false

		for (const name of activationEvents) this.group.removeEventListener(name, this.onEvent, true)

		this.unsubscribe?.()
		this.hint.remove()
		this.list.remove()
		this.other.unload()
		this.feedback.remove()
		this.group.classList.remove('answer-choices', 'answer-has-selection')
		this.group.removeAttribute('role')
		this.group.removeAttribute('aria-label')
	}
}
