import {
	MarkdownRenderChild,
	type MarkdownPostProcessorContext,
	setIcon,
	type TFile,
} from 'obsidian'

import { QuestionAppearance } from '#/src/answer-appearance'
import type { ControlActions } from '#/src/answer-control'
import type { AnswerTarget } from '#/src/answer-target'
import type { ConfirmDiscard } from '#/src/confirm-discard'
import type { Draft } from '#/src/drafts'
import { canEdit, type QuestionBlock } from '#/src/question-blocks'
import { QuestionControl } from '#/src/question-control'
import { questionLabel, renderedQuestionLabel } from '#/src/question-label'
import { answerCallouts } from '#/src/reading-callouts'
import { sectionTargets } from '#/src/section-targets'
import { whenAttached } from '#/src/when-attached'

export interface RenderHost {
	readonly confirm: ConfirmDiscard
	readonly inReadingView: (element: HTMLElement, sourcePath: string) => boolean
	readonly file: (sourcePath: string) => TFile | null
	readonly draft: (file: TFile, target: AnswerTarget) => Draft
	readonly save: (file: TFile, draft: Draft) => Promise<boolean>
	readonly modal: (file: TFile, draft: Draft) => void
	readonly released: (section: AnswerSection) => void
}

const eligibleQuestion = (block: QuestionBlock | undefined): block is QuestionBlock =>
	block !== undefined && canEdit(block)

class RenderedQuestion extends MarkdownRenderChild {
	private readonly control: QuestionControl
	private readonly appearance: QuestionAppearance

	constructor(element: HTMLElement, block: QuestionBlock, actions: ControlActions) {
		super(element)
		this.appearance = new QuestionAppearance(element, actions.renderIcon)
		this.control = new QuestionControl(element, block, {
			...actions,
			state: (target): void => this.paint(target),
		})
	}

	private paint(target: AnswerTarget): void {
		this.appearance.paint(target.answer?.content)
	}

	override onload(): void {
		this.control.load()
	}
	override onunload(): void {
		this.control.unload()
		this.appearance.unload()
	}
}

export class AnswerSection extends MarkdownRenderChild {
	private readonly context: MarkdownPostProcessorContext
	private readonly host: RenderHost

	constructor(element: HTMLElement, context: MarkdownPostProcessorContext, host: RenderHost) {
		super(element)
		this.context = context
		this.host = host
	}

	override onload(): void {
		this.register(whenAttached(this.containerEl, () => this.mount()))
	}

	private mount(): void {
		const element = this.containerEl

		if (!this.host.inReadingView(element, this.context.sourcePath)) return

		if (element.closest('.internal-embed, .markdown-embed, .popover, .hover-popover') !== null)
			return
		const file = this.host.file(this.context.sourcePath)

		if (file === null) return
		const section = this.context.getSectionInfo(element)

		if (section === null) return
		const callouts = answerCallouts(element)
		const targets = sectionTargets(section, callouts.length)

		for (const [index, callout] of callouts.entries())
			this.mountControl(callout, targets[index], file)
	}

	private actions(file: TFile): ControlActions {
		return {
			renderIcon: setIcon,
			confirm: this.host.confirm,
			draft: (next): Draft => this.host.draft(file, next),
			save: (draft): Promise<boolean> => this.host.save(file, draft),
			modal: (draft): void => this.host.modal(file, draft),
		}
	}

	private mountControl(callout: HTMLElement, block: QuestionBlock | undefined, file: TFile): void {
		if (!eligibleQuestion(block)) return

		if (renderedQuestionLabel(callout) !== questionLabel(block.question)) return

		if (callout.classList.contains('answer-question')) return
		this.addChild(new RenderedQuestion(callout, block, this.actions(file)))
	}

	override onunload(): void {
		this.host.released(this)
	}
}
