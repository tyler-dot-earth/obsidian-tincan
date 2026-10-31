import type { Draft } from '#/src/drafts'

export interface DiscardConfirmation {
	readonly title: string
	readonly description: string
	readonly action: string
	readonly text: string
}

export type ConfirmDiscard = (request: DiscardConfirmation) => Promise<boolean>

const clearNoteConfirmation = (draft: Draft): DiscardConfirmation | undefined => {
	const content = draft.target.answer?.content

	if (
		draft.target.field === 'answer' ||
		content?.kind !== 'text' ||
		content.text.trim() === '' ||
		draft.text.trim() !== ''
	)
		return undefined

	return {
		title: 'Clear this note?',
		description: 'Your written note will be removed.',
		action: 'Clear note',
		text: content.text,
	}
}

export const confirmNoteSave = async (draft: Draft, confirm: ConfirmDiscard): Promise<boolean> => {
	const request = clearNoteConfirmation(draft)

	if (request === undefined) return true
	const text = draft.text

	return (await confirm(request)) && draft.text === text
}

export const replaceAnswerConfirmation = (text: string, label: string): DiscardConfirmation => ({
	title: 'Replace your written answer with “' + label + '”?',
	description: 'Your written answer will be removed.',
	action: 'Replace answer',
	text,
})
