import { answerText } from '#/src/answer-content'
import type { AnswerTarget } from '#/src/answer-target'

/** Owned by the plugin, never by a disposable Markdown section. */
export class Draft {
	readonly target: AnswerTarget
	savedTarget: AnswerTarget | undefined
	text = ''
	otherText = ''
	otherEditing = false
	editing = false
	saving = false
	saved = false
	selectionStart = 0
	selectionEnd = 0
	focusedOption = 0
	wantsFocus = false
	private readonly listeners = new Set<() => void>()

	constructor(target: AnswerTarget) {
		this.target = target
		const content = target.answer?.content
		this.otherText = content === undefined || content.kind === 'text' ? '' : (content.other ?? '')
		this.text = target.answer?.content === undefined ? '' : answerText(target.answer?.content)
	}

	get initialText(): string {
		return this.target.answer?.content === undefined ? '' : answerText(this.target.answer?.content)
	}

	get initialOther(): string {
		const content = this.target.answer?.content

		return content === undefined || content.kind === 'text' ? '' : (content.other ?? '')
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener)

		return () => this.listeners.delete(listener)
	}

	notify(): void {
		for (const listener of this.listeners) listener()
	}
}

export interface FileDraft<File> {
	readonly file: File
	readonly draft: Draft
}

export class Drafts<File> {
	private readonly files = new Map<File, Map<string, Draft>>()

	get(file: File, target: AnswerTarget): Draft {
		let drafts = this.files.get(file)

		if (drafts === undefined) {
			drafts = new Map()
			this.files.set(file, drafts)
		}

		const key = JSON.stringify([
			target.question,
			target.context,
			target.field,
			target.answer?.source,
		])

		let draft = drafts.get(key)

		if (draft === undefined || draft.saved) {
			draft = new Draft(target)
			drafts.set(key, draft)
		}

		return draft
	}

	pending(): FileDraft<File>[] {
		const pending: FileDraft<File>[] = []

		for (const [file, drafts] of this.files) {
			for (const draft of drafts.values()) {
				if (
					!draft.saved &&
					(draft.editing ||
						draft.text !== draft.initialText ||
						draft.otherText !== draft.initialOther)
				)
					pending.push({ file, draft })
			}
		}

		return pending
	}
}
