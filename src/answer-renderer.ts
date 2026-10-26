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
import type { Draft } from '#/src/drafts'
import { canAnnotate, canEdit, type QuestionBlock } from '#/src/question-blocks'
import { QuestionControl } from '#/src/question-control'
import { questionLabel, renderedQuestionLabel } from '#/src/question-label'
import { answerCallouts } from '#/src/reading-callouts'
import { sectionTargets, type SectionSource } from '#/src/section-targets'
import { questionCallout, sideNoteItems } from '#/src/side-note-items'
import { whenAttached } from '#/src/when-attached'

export interface RenderHost {
	readonly inReadingView: (element: HTMLElement, sourcePath: string) => boolean
	readonly file: (sourcePath: string) => TFile | null
	readonly draft: (file: TFile, target: AnswerTarget) => Draft
	readonly save: (file: TFile, draft: Draft) => Promise<boolean>
	readonly modal: (file: TFile, draft: Draft) => void
	readonly released: (section: AnswerSection) => void
}

const paintCallout = (element: HTMLElement, target: AnswerTarget): void => {
	applyAppearance(element, 'answer', target.answer?.content)
	const content = target.answer?.content
	const answered = content !== undefined && isAnswered(content)
	const icon = element.querySelector<HTMLElement>(':scope > .callout-title > .callout-icon')

	if (icon !== null) setIcon(icon, answered ? 'circle-check' : 'circle-help')
}

const eligibleQuestion = (block: QuestionBlock | undefined): block is QuestionBlock =>
	block !== undefined && canAnnotate(block) && (block.slots.length === 0 || canEdit(block))

class RenderedQuestion extends MarkdownRenderChild {
	private readonly control: QuestionControl
	private readonly removeOnUnload: boolean
	private readonly icon: HTMLElement | null
	private readonly originalIcon: Node[]

	constructor(
		element: HTMLElement,
		block: QuestionBlock,
		actions: ControlActions,
		removeOnUnload = false,
	) {
		super(element)
		this.removeOnUnload = removeOnUnload
		this.icon = element.querySelector<HTMLElement>(':scope > .callout-title > .callout-icon')
		this.originalIcon = Array.from(this.icon?.childNodes ?? [])
		this.control = new QuestionControl(element, block, {
			...actions,
			state: (target): void => paintCallout(element, target),
		})
	}

	override onload(): void {
		this.control.load()
	}
	override onunload(): void {
		this.control.unload()
		this.containerEl.classList.remove(...appearanceClasses)
		this.icon?.replaceChildren(...this.originalIcon)

		if (this.removeOnUnload) this.containerEl.remove()
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
		this.mountMissingNotes(element, section, file)
	}

	private actions(file: TFile): ControlActions {
		return {
			draft: (next): Draft => this.host.draft(file, next),
			save: (draft): Promise<boolean> => this.host.save(file, draft),
			modal: (draft): void => this.host.modal(file, draft),
		}
	}

	private mountMissingNotes(element: HTMLElement, section: SectionSource, file: TFile): void {
		for (const item of sideNoteItems(element, section)) {
			if (
				!canAnnotate(item.block) ||
				item.block.notes.length !== 0 ||
				item.block.slots.length !== 0 ||
				item.element.querySelector(':scope > .answer-question') !== null
			)
				continue
			const box = questionCallout(item.element)
			this.addChild(new RenderedQuestion(box, item.block, this.actions(file), true))
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
