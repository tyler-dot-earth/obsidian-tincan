import { type QuestionBlock, questionBlocks } from '#/src/question-blocks'
import { questionLabel, renderedQuestionLabel } from '#/src/question-label'
import type { SectionSource } from '#/src/section-targets'

export interface SideNoteItem {
	readonly element: HTMLElement
	readonly block: QuestionBlock
}

/** Source order and labels must agree; data-line never establishes identity. */
export const sideNoteItems = (element: HTMLElement, section: SectionSource): SideNoteItem[] => {
	const elements = Array.from(element.querySelectorAll<HTMLElement>('li.task-list-item'))

	if (element.matches('li.task-list-item')) elements.unshift(element)

	const rendered = elements.filter(
		(item) =>
			item.closest('.callout, blockquote, .internal-embed, .markdown-embed, .popover') === null,
	)

	const blocks = questionBlocks(section.text).filter(
		(block) => block.line >= section.lineStart && block.line <= section.lineEnd,
	)

	if (rendered.length !== blocks.length) return []

	return rendered.flatMap((item, index) => {
		const block = blocks[index]

		return block !== undefined && questionLabel(block.question) === renderedQuestionLabel(item)
			? [{ element: item, block }]
			: []
	})
}

export const questionCallout = (item: HTMLElement): HTMLElement => {
	const callout = item.ownerDocument.createElement('div')
	callout.className = 'callout answer-unanswered'
	callout.dataset['callout'] = 'answer'
	const title = item.ownerDocument.createElement('div')
	title.className = 'callout-title'
	const icon = item.ownerDocument.createElement('div')
	icon.className = 'callout-icon'
	const text = item.ownerDocument.createElement('div')
	text.textContent = 'Answer'
	title.append(icon, text)
	callout.append(title)
	item.append(callout)

	return callout
}
