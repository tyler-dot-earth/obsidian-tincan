import { type App, Modal, SuggestModal, type TFile } from 'obsidian'

import { mountEditor } from '#/src/answer-editor'
import { ChoiceControl, type ChoiceActions } from '#/src/choice-control'
import type { Draft, FileDraft } from '#/src/drafts'

export class AnswerModal extends Modal {
	private cleanup: (() => void) | undefined
	private readonly draft: Draft
	private readonly actions: ChoiceActions
	private readonly closed: (modal: AnswerModal) => void

	constructor(
		app: App,
		draft: Draft,
		actions: ChoiceActions,
		closed: (modal: AnswerModal) => void,
	) {
		super(app)
		this.draft = draft
		this.actions = actions
		this.closed = closed
	}

	override onOpen(): void {
		this.titleEl.textContent = this.draft.target.question
		this.contentEl.classList.add('answer-editor')
		this.draft.editing = true
		this.draft.wantsFocus = true

		if (
			this.draft.target.field === 'answer' &&
			this.draft.target.answer?.content?.kind !== 'text'
		) {
			const choices = new ChoiceControl(this.contentEl, this.draft, this.actions)
			this.cleanup = (): void => choices.unload()

			return
		}

		this.cleanup = mountEditor(this.contentEl, this.draft, {
			save: () => this.actions.save(this.draft),
			modal: undefined,
			done: () => this.close(),
		})
	}

	override onClose(): void {
		this.cleanup?.()
		this.contentEl.replaceChildren()
		this.closed(this)
	}
}

export class DraftPicker extends SuggestModal<FileDraft<TFile>> {
	private readonly drafts: readonly FileDraft<TFile>[]
	private readonly choose: (item: FileDraft<TFile>) => void

	constructor(
		app: App,
		drafts: readonly FileDraft<TFile>[],
		choose: (item: FileDraft<TFile>) => void,
	) {
		super(app)
		this.drafts = drafts
		this.choose = choose
		this.setPlaceholder('Resume an answer draft…')
	}

	override getSuggestions(query: string): FileDraft<TFile>[] {
		return this.drafts.filter(({ file, draft }) =>
			`${file.path} ${draft.target.question}`.toLowerCase().includes(query.toLowerCase()),
		)
	}

	override renderSuggestion(item: FileDraft<TFile>, element: HTMLElement): void {
		element.textContent = `${item.file.path}: ${item.draft.target.question}`
	}

	override onChooseSuggestion(item: FileDraft<TFile>): void {
		this.choose(item)
	}
}
