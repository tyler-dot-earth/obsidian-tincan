import { applyAppearance, appearanceClasses } from '#/src/answer-appearance'
import { mountEditor } from '#/src/answer-editor'
import type { AnswerTarget } from '#/src/answer-target'
import { ChoiceControl, type ChoiceActions } from '#/src/choice-control'
import type { Draft } from '#/src/drafts'

export interface ControlActions extends ChoiceActions {
	readonly modal: (draft: Draft) => void
}

export class AnswerControl {
	private readonly containerEl: HTMLElement
	private draft: Draft
	private readonly actions: ControlActions
	private readonly preserved: readonly Node[]
	private cleanup: (() => void) | undefined
	private content: HTMLElement | undefined
	private original: Node[] = []
	private unsubscribe: (() => void) | undefined

	constructor(
		element: HTMLElement,
		draft: Draft,
		actions: ControlActions,
		preserved: readonly Node[] = [],
	) {
		this.containerEl = element
		this.draft = draft
		this.actions = actions
		this.preserved = preserved
	}

	load(): void {
		const content =
			this.containerEl.querySelector<HTMLElement>(':scope > .callout-content') ??
			this.containerEl.appendChild(this.containerEl.ownerDocument.createElement('div'))

		this.content = content
		this.original = Array.from(content.childNodes).filter((node) => !this.preserved.includes(node))

		this.containerEl.classList.add('answer-callout')

		this.updateState(this.draft.target)

		if (
			this.draft.target.field === 'answer' &&
			this.draft.target.answer?.content?.kind !== 'text'
		) {
			this.replaceContent()

			const choices = new ChoiceControl(content, this.draft, {
				...this.actions,
				state: (target): void => this.updateState(target),
			})

			content.append(...this.preserved)
			this.cleanup = (): void => choices.unload()

			return
		}

		this.watchDraft()
		this.show()
	}

	private replaceContent(...nodes: Node[]): void {
		this.content?.replaceChildren(...nodes, ...this.preserved)
	}

	private updateState(target: AnswerTarget): void {
		applyAppearance(this.containerEl, target.field, target.answer?.content)
		this.actions.state?.(target)
	}

	private watchDraft(): void {
		this.unsubscribe?.()
		this.unsubscribe = this.draft.subscribe(() => {
			if (this.draft.saved) {
				this.updateState(this.draft.savedTarget ?? this.draft.target)
				this.show()
			}
		})
	}

	private showSaved(): void {
		this.cleanup?.()

		if (this.content === undefined) return

		const text = this.content.ownerDocument.createElement('p')

		text.className = 'answer-saved'
		text.textContent = this.draft.text
		this.original = [text]
		this.replaceContent(text)
		this.appendAction(this.draft.target.field === 'note' ? 'Edit note' : 'Edit', () => {
			const target = this.draft.savedTarget

			if (target === undefined) return
			this.draft = this.actions.draft(target)
			this.watchDraft()
			this.openEditor()
		})
		this.appendNoteAction()
	}

	private openEditor(): void {
		this.draft.editing = true
		this.draft.wantsFocus = true
		this.show()
	}

	private appendAction(label: string, action: () => void, container = this.content): void {
		const content = container

		if (content === undefined) return
		const button = content.ownerDocument.createElement('button')
		button.type = 'button'
		button.textContent = label

		if (label === 'Edit' || label === 'Edit note' || label === 'Add a note')
			button.className = 'answer-link'
		button.addEventListener('click', (event) => {
			event.stopPropagation()
			action()
		})
		content.insertBefore(button, content === this.content ? (this.preserved[0] ?? null) : null)
	}

	private show(): void {
		this.cleanup?.()
		const content = this.content

		if (content === undefined) return
		content.replaceChildren()

		content.classList.remove('answer-editor')

		if (this.draft.saved) {
			this.showSaved()

			return
		}

		if (this.draft.editing) {
			content.classList.add('answer-editor')
			this.cleanup = mountEditor(content, this.draft, {
				save: () => this.actions.save(this.draft),
				modal: () => this.actions.modal(this.draft),
				done: () => this.show(),
			})

			content.append(...this.preserved)

			return
		}

		this.replaceContent(...this.original)
		const changed = this.draft.text !== this.draft.initialText
		const blank = this.draft.target.answer?.blank !== false
		const label = changed ? 'Resume draft…' : this.actionLabel(blank)
		const actions = content.ownerDocument.createElement('div')
		actions.className = 'answer-actions'
		content.insertBefore(actions, this.preserved[0] ?? null)
		this.appendAction(label, () => this.openEditor(), actions)
		this.appendNoteAction(actions)
	}

	private appendNoteAction(container = this.content): void {
		if (this.actions.addNote !== undefined)
			this.appendAction('Add a note', this.actions.addNote, container)
	}

	private actionLabel(blank: boolean): string {
		if (this.draft.target.field === 'note') return blank ? 'Add note' : 'Edit note'

		return blank ? 'Answer…' : 'Edit'
	}

	unload(): void {
		this.cleanup?.()
		this.unsubscribe?.()

		this.containerEl.classList.remove('answer-callout', ...appearanceClasses)
		this.content?.classList.remove('answer-editor')
		this.replaceContent(...this.original)
	}
}
