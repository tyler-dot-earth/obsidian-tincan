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
	private cleanup: (() => void) | undefined
	private content: HTMLElement | undefined
	private original: Node[] = []
	private unsubscribe: (() => void) | undefined

	constructor(element: HTMLElement, draft: Draft, actions: ControlActions) {
		this.containerEl = element
		this.draft = draft
		this.actions = actions
	}

	load(): void {
		const content =
			this.containerEl.querySelector<HTMLElement>(':scope > .callout-content') ??
			this.containerEl.appendChild(this.containerEl.ownerDocument.createElement('div'))

		content.classList.add('callout-content')
		this.content = content
		this.original = Array.from(content.childNodes)

		this.containerEl.classList.add('answer-callout')

		this.updateState(this.draft.target)

		if (
			this.draft.target.field === 'answer' &&
			this.draft.target.answer?.content?.kind !== 'text'
		) {
			content.replaceChildren()

			const choices = new ChoiceControl(content, this.draft, {
				...this.actions,
				state: (target): void => this.updateState(target),
			})

			this.cleanup = (): void => choices.unload()

			return
		}

		this.watchDraft()
		this.show()
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
		const text = this.content.ownerDocument.createElement('div')
		text.className = 'answer-saved'
		text.textContent = this.draft.text
		this.original = [text]
		this.content.replaceChildren(text)
		this.appendAction(this.draft.target.field === 'note' ? 'Edit note' : 'Edit', () => {
			const target = this.draft.savedTarget

			if (target === undefined) return
			this.draft = this.actions.draft(target)
			this.watchDraft()
			this.openEditor()
		})
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

		if (label === 'Edit') button.className = 'answer-link'
		button.addEventListener('click', (event) => {
			event.stopPropagation()
			action()
		})
		content.append(button)
	}

	private show(): void {
		this.cleanup?.()
		const content = this.content

		if (content === undefined) return
		content.replaceChildren()

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

			return
		}

		content.classList.remove('answer-editor')
		content.append(...this.original)
		const changed = this.draft.text !== this.draft.initialText
		const blank = this.draft.target.answer?.blank !== false
		const label = changed ? 'Resume draft…' : this.actionLabel(blank)
		const actions = content.ownerDocument.createElement('div')
		actions.className = 'answer-actions'
		content.append(actions)
		this.appendAction(label, () => this.openEditor(), actions)
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
		this.content?.replaceChildren(...this.original)
	}
}
