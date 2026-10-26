import { answerContent } from '#/src/answer-content'
import type { Draft } from '#/src/drafts'

export interface OtherActions {
	readonly draft: () => Draft
	readonly save: (text: string) => void
	readonly select: () => void
	readonly busy: () => boolean
}

/** Saved custom text reads as a checked option; its editor is only opened deliberately. */
export class OtherControl {
	private readonly actions: OtherActions
	private readonly row: HTMLElement
	private readonly label: HTMLLabelElement
	private readonly checkbox: HTMLInputElement
	private readonly value: HTMLElement
	private readonly edit: HTMLButtonElement
	private readonly editor: HTMLElement
	private readonly textarea: HTMLTextAreaElement
	private readonly save: HTMLButtonElement
	private readonly cancel: HTMLButtonElement

	constructor(container: HTMLElement, actions: OtherActions) {
		this.actions = actions
		const document = container.ownerDocument
		this.row = document.createElement('div')
		this.row.className = 'answer-other-row'
		this.label = document.createElement('label')
		this.checkbox = document.createElement('input')
		this.checkbox.type = 'checkbox'
		this.checkbox.className = 'answer-other-toggle'
		this.value = document.createElement('span')
		this.label.append(this.checkbox, this.value)
		this.edit = this.button(document, 'Edit', 'answer-other-edit')
		this.row.append(this.label)
		this.editor = document.createElement('div')
		this.editor.className = 'answer-other-editor'
		this.textarea = document.createElement('textarea')
		this.textarea.rows = 2
		this.textarea.setAttribute('aria-label', 'Other answer')
		const controls = document.createElement('div')
		controls.className = 'answer-controls'
		this.save = this.button(document, 'Save', 'answer-other-save')
		this.cancel = this.button(document, 'Cancel', 'answer-other-cancel')
		controls.append(this.save, this.cancel)
		this.editor.append(this.textarea, controls)
		container.append(this.row, this.editor)
	}

	private button(document: Document, text: string, className: string): HTMLButtonElement {
		const button = document.createElement('button')
		button.type = 'button'
		button.textContent = text
		button.className = 'answer-link ' + className

		return button
	}

	private savedText(): string {
		const draft = this.actions.draft()
		const kind = draft.target.answer?.content?.kind

		if (kind === undefined || kind === 'text') return ''
		const content = answerContent(kind, draft.text)

		return content === undefined || content.kind === 'text' ? '' : (content.other ?? '')
	}

	handle(event: Event): boolean {
		if (event.type === 'input' && event.target === this.textarea) {
			this.actions.draft().otherText = this.textarea.value
			this.actions.draft().notify()

			return true
		}

		if (event.type !== 'click') return false

		return this.click(event)
	}

	private click(event: Event): boolean {
		const path = event.composedPath()

		if (path.includes(this.label)) {
			event.preventDefault()

			if (this.actions.busy()) return true

			if (this.savedText().trim() === '') {
				this.open()
				this.actions.select()
			} else this.actions.save('')
			queueMicrotask(() => this.refresh(this.actions.busy()))

			return true
		}

		return this.clickAction(event.target)
	}

	private clickAction(target: EventTarget | null): boolean {
		if (target === this.edit) {
			this.open()

			return true
		}

		if (target === this.save) {
			this.actions.save(this.actions.draft().otherText)

			return true
		}

		if (target === this.cancel) {
			this.actions.draft().otherEditing = false
			this.actions.draft().notify()

			return true
		}

		return false
	}

	private open(): void {
		if (this.actions.busy()) return
		this.actions.draft().otherEditing = true
		this.actions.draft().notify()
		this.textarea.focus({ preventScroll: true })
	}

	refresh(disabled: boolean): void {
		const draft = this.actions.draft()
		const saved = this.savedText()
		const pending = draft.otherText !== saved
		this.checkbox.checked = saved.trim() !== ''
		this.checkbox.disabled = disabled
		this.value.textContent = saved.trim() === '' ? 'Other' : 'Other: ' + saved

		if (this.checkbox.checked) this.row.append(this.edit)
		else this.edit.remove()

		this.edit.disabled = disabled
		this.row.hidden = draft.otherEditing
		this.editor.hidden = !draft.otherEditing

		if (this.textarea.value !== draft.otherText) this.textarea.value = draft.otherText
		this.textarea.disabled = disabled
		this.save.disabled = disabled || !pending
		this.cancel.disabled = disabled
	}
}
