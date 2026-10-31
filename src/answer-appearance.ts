import { type AnswerContent, isAnswered } from '#/src/answer-content'
import type { AnswerField } from '#/src/answer-target'

export const appearanceClasses = ['answer-answered', 'answer-unanswered', 'answer-side-note']

export const applyAppearance = (
	element: HTMLElement,
	field: AnswerField,
	content: AnswerContent | undefined,
): void => {
	const answered = content !== undefined && isAnswered(content)
	element.classList.toggle('answer-answered', field === 'answer' && answered)
	element.classList.toggle('answer-unanswered', field === 'answer' && !answered)
	element.classList.toggle('answer-side-note', field !== 'answer')
}

/** The same saved-state presentation is used by native widgets and reading controls. */
export class QuestionAppearance {
	private readonly element: HTMLElement
	private readonly status: HTMLElement
	private readonly icon: HTMLElement | null
	private readonly originalIcon: Node[]
	private readonly renderIcon: ((element: HTMLElement, icon: string) => void) | undefined

	constructor(element: HTMLElement, renderIcon: QuestionAppearance['renderIcon']) {
		this.element = element
		this.renderIcon = renderIcon
		this.icon = element.querySelector<HTMLElement>(':scope > .callout-title > .callout-icon')
		this.originalIcon = Array.from(this.icon?.childNodes ?? [])
		this.status = element.ownerDocument.createElement('span')
		this.status.className = 'answer-status'
		this.status.textContent = 'Answered'
		this.status.hidden = true
		element.querySelector(':scope > .callout-title')?.append(this.status)
	}

	paint(content: AnswerContent | undefined): void {
		applyAppearance(this.element, 'answer', content)
		const answered = content !== undefined && isAnswered(content)
		this.status.hidden = !answered

		if (this.icon === null) return

		if (answered) this.renderIcon?.(this.icon, 'circle-check')
		else this.icon.replaceChildren(...this.originalIcon)
	}

	unload(): void {
		this.element.classList.remove(...appearanceClasses)
		this.status.remove()
		this.icon?.replaceChildren(...this.originalIcon)
	}
}
