import { answerContent } from '#/src/answer-content'
import type { Draft } from '#/src/drafts'

export interface OtherActions {
	readonly draft: () => Draft
	readonly save: (text: string) => void
	readonly renderIcon: ((element: HTMLElement, icon: string) => void) | undefined
	readonly addNote: (() => void) | undefined
	readonly busy: () => boolean
}

/** Custom answers have a theme-native callout; their source remains an Other paragraph. */
export class OtherControl {
	private readonly actions: OtherActions
	private readonly row: HTMLElement
	private readonly callout: HTMLElement
	private readonly savedActions: HTMLElement
	private readonly write: HTMLButtonElement
	private readonly clear: HTMLButtonElement
	private readonly value: HTMLElement
	private readonly note: HTMLButtonElement | undefined
	private readonly edit: HTMLButtonElement
	private readonly editor: HTMLElement
	private readonly textarea: HTMLTextAreaElement
	private readonly save: HTMLButtonElement
	private readonly cancel: HTMLButtonElement

	constructor(container: HTMLElement, actions: OtherActions) {
		this.actions = actions
		const document = container.ownerDocument
		this.value = document.createElement('p')
		this.value.className = 'answer-other-value'
		this.row = document.createElement('div')
		this.row.className = 'answer-other-row answer-actions'
		this.write = this.button(document, 'Write another answer…', 'answer-other-write')
		this.edit = this.button(document, 'Edit', 'answer-other-edit')
		this.clear = this.button(document, 'Clear', 'answer-other-clear')
		this.row.append(this.write)
		this.savedActions = document.createElement('div')
		this.savedActions.className = 'answer-actions'
		this.savedActions.append(this.edit, this.clear)
		this.note =
			actions.addNote === undefined
				? undefined
				: this.button(document, 'Add a note', 'answer-add-note')

		if (this.note !== undefined) this.row.append(this.note)
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
		this.callout = this.createCallout(document)
		container.append(this.callout, this.row)
	}

	private createCallout(document: Document): HTMLElement {
		const callout = document.createElement('div')
		callout.className = 'callout answer-other-callout'
		callout.setAttribute('data-callout', 'quote')
		const title = document.createElement('div')
		title.className = 'callout-title'
		const icon = document.createElement('div')
		icon.className = 'callout-icon'
		this.actions.renderIcon?.(icon, 'quote')
		const heading = document.createElement('div')
		heading.className = 'callout-title-inner'
		heading.textContent = 'Other answer'
		title.append(icon, heading)
		const body = document.createElement('div')
		body.className = 'callout-content'
		body.append(this.value, this.savedActions, this.editor)
		callout.append(title, body)

		return callout
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

		if (this.actions.busy()) return true

		return this.clickAction(event.target)
	}

	private clickAction(target: EventTarget | null): boolean {
		if (target === this.write || target === this.edit) {
			this.open()

			return true
		}

		if (target === this.note) {
			this.actions.addNote?.()

			return true
		}

		if (target === this.clear) {
			this.actions.save('')

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

	unload(): void {
		this.callout.remove()
		this.row.remove()
		this.editor.remove()
	}

	refresh(disabled: boolean): void {
		const draft = this.actions.draft()
		const saved = this.savedText()
		const pending = draft.otherText !== saved
		const answered = saved.trim() !== ''
		this.value.textContent = saved
		this.callout.hidden = !answered && !draft.otherEditing
		this.savedActions.hidden = draft.otherEditing
		this.value.hidden = draft.otherEditing || !answered
		this.write.hidden = answered
		this.edit.hidden = !answered
		this.clear.hidden = !answered
		this.write.disabled = disabled
		this.edit.disabled = disabled
		this.clear.disabled = disabled

		if (this.note !== undefined) this.note.disabled = disabled
		this.row.hidden = draft.otherEditing || (answered && this.note === undefined)
		this.editor.hidden = !draft.otherEditing

		if (this.textarea.value !== draft.otherText) this.textarea.value = draft.otherText
		this.textarea.disabled = disabled
		this.save.disabled = disabled || !pending
		this.cancel.disabled = disabled
	}
}
