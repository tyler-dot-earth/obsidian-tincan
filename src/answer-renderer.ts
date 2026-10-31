import {
	MarkdownRenderChild,
	type MarkdownPostProcessorContext,
	setIcon,
	type TFile,
} from 'obsidian'

import { applyAppearance, appearanceClasses } from '#/src/answer-appearance'
import { isAnswered } from '#/src/answer-content'
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
	private readonly status: HTMLElement
	private readonly icon: HTMLElement | null
	private readonly originalIcon: Node[]

	constructor(element: HTMLElement, block: QuestionBlock, actions: ControlActions) {
		super(element)
		this.icon = element.querySelector<HTMLElement>(':scope > .callout-title > .callout-icon')
		this.originalIcon = Array.from(this.icon?.childNodes ?? [])
		this.status = element.ownerDocument.createElement('span')
		this.status.className = 'answer-status'
		this.status.textContent = 'Answered'
		this.status.hidden = true
		element.querySelector(':scope > .callout-title')?.append(this.status)
		this.control = new QuestionControl(element, block, {
			...actions,
			state: (target): void => this.paint(target),
		})
	}

	private paint(target: AnswerTarget): void {
		applyAppearance(this.containerEl, 'answer', target.answer?.content)
		const content = target.answer?.content
		const answered = content !== undefined && isAnswered(content)
		this.status.hidden = !answered

		if (this.icon === null) return

		if (answered) setIcon(this.icon, 'circle-check')
		else this.icon.replaceChildren(...this.originalIcon)
	}

	override onload(): void {
		this.control.load()
	}
	override onunload(): void {
		this.control.unload()
		this.containerEl.classList.remove(...appearanceClasses)
		this.status.remove()
		this.icon?.replaceChildren(...this.originalIcon)
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
