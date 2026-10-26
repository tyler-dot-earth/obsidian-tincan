import { type AnswerContent, isAnswered } from '#/src/answer-content'

export const appearanceClasses = ['answer-answered', 'answer-unanswered', 'answer-side-note']

export const applyAppearance = (
	element: HTMLElement,
	field: 'answer' | 'note',
	content: AnswerContent | undefined,
): void => {
	const answered = content !== undefined && isAnswered(content)
	element.classList.toggle('answer-answered', field === 'answer' && answered)
	element.classList.toggle('answer-unanswered', field === 'answer' && !answered)
	element.classList.toggle('answer-side-note', field === 'note')
}
