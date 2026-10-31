import { choiceReplacement } from '#/src/choice-replacement'
import { lineEnding, sourceLines } from '#/src/markdown-lines'
import type { OptionNotes } from '#/src/option-notes'
import {
	canEdit,
	canAnnotate,
	type AnswerSlot,
	type QuestionBlock,
	questionBlocks,
} from '#/src/question-blocks'
import { AnswerError } from '#/src/write-error'

export { AnswerError } from '#/src/write-error'

export type AnswerField = 'answer' | 'note' | `option:${string}`

export interface AnswerTarget {
	readonly question: string
	readonly context: string
	readonly answer: AnswerSlot | undefined
	readonly field: AnswerField
}

export const slotIdentity = (slot: AnswerSlot | undefined): string | undefined =>
	slot?.identity ?? slot?.source

const optionFor = (block: QuestionBlock, field: AnswerField): OptionNotes | undefined =>
	block.optionNotes.find((option) => `option:${option.label}` === field)

const fieldSlots = (block: QuestionBlock, field: AnswerField): readonly AnswerSlot[] => {
	if (field === 'answer') return block.slots

	if (field === 'note') return block.notes

	return optionFor(block, field)?.notes ?? []
}

const editableField = (block: QuestionBlock, field: AnswerField): boolean => {
	if (field === 'answer') return canEdit(block)

	if (field === 'note') return canAnnotate(block)
	const option = optionFor(block, field)

	return canEdit(block) && option !== undefined && option.notes.length <= 1
}

export const answerTarget = (block: QuestionBlock, field: AnswerField = 'answer'): AnswerTarget => {
	const answer = fieldSlots(block, field)[0]

	if (block.context === undefined || !editableField(block, field))
		throw new AnswerError({
			message: 'The question is ambiguous; your draft is kept.',
		})

	return {
		question: block.question,
		context: block.context,
		answer,
		field,
	}
}

export const targetFor = (
	source: string,
	question: string,
	field: AnswerField = 'answer',
): AnswerTarget => {
	const matches = questionBlocks(source).filter((block) => block.question === question)
	const block = matches[0]

	if (matches.length !== 1 || block === undefined)
		throw new AnswerError({ message: 'The question is missing or duplicated; your draft is kept.' })

	return answerTarget(block, field)
}

export const matchTarget = (source: string, target: AnswerTarget): QuestionBlock => {
	const matches = questionBlocks(source).filter((block) => block.question === target.question)

	if (matches.length !== 1)
		throw new AnswerError({ message: 'The question is missing or duplicated; your draft is kept.' })
	const block = matches[0]

	if (block === undefined || block.context !== target.context)
		throw new AnswerError({ message: 'The question context changed; your draft is kept.' })

	if (!editableField(block, target.field))
		throw new AnswerError({
			message: 'The question is ambiguous; your draft is kept.',
		})

	const slot = fieldSlots(block, target.field)[0]

	if (slotIdentity(slot) !== slotIdentity(target.answer))
		throw new AnswerError({ message: 'The answer changed; your draft is kept.' })

	return block
}

/** Runs synchronously inside Vault.process, never against a remembered line number. */
export const writeAnswer = (source: string, target: AnswerTarget, answer: string): string => {
	if (target.field === 'answer' && answer.trim() === '')
		throw new AnswerError({ message: 'Type an answer before saving.' })
	const block = matchTarget(source, target)
	const slot = fieldSlots(block, target.field)[0]

	if (slot === undefined) return insertFieldNote(source, block, target.field, answer)

	return replaceSlot(source, slot, answer)
}

const insertOptionNote = (
	source: string,
	block: QuestionBlock,
	field: AnswerField,
	text: string,
): string => {
	if (text.trim() === '') throw new AnswerError({ message: 'Type a note before saving.' })
	const option = optionFor(block, field)
	const lines = sourceLines(source)
	const line = option === undefined ? undefined : lines[option.line]

	if (line === undefined)
		throw new AnswerError({ message: 'The option changed; your draft is kept.' })
	const newline = lineEnding(lines, line)
	const prefix = block.slots[0].prefix + '   >'

	const body = text
		.replace(/\r\n|\r/g, '\n')
		.split('\n')
		.map((part) => prefix + ' ' + part)
		.join(newline)

	const end = line.offset + line.text.length + line.ending.length
	const trailing = line.ending === '' ? '' : newline

	return (
		source.slice(0, end) +
		(line.ending === '' ? newline : '') +
		prefix +
		' [!note]' +
		newline +
		body +
		trailing +
		source.slice(end)
	)
}

const replaceSlot = (source: string, slot: AnswerSlot, answer: string): string => {
	if (slot.content?.kind !== 'text')
		return source.slice(0, slot.start) + choiceReplacement(slot, answer) + source.slice(slot.end)
	const lines = sourceLines(source)
	const header = lines[slot.line]

	if (header === undefined)
		throw new AnswerError({ message: 'The answer callout is missing; your draft is kept.' })
	const newline = lineEnding(lines, header)

	const body = answer
		.replace(/\r\n|\r/g, '\n')
		.split('\n')
		.map((text) => `${slot.prefix} ${text}`)
		.join(newline)

	const trailing = slot.end < source.length || source.endsWith(newline) ? newline : ''

	return (
		source.slice(0, slot.start) +
		(slot.leading ?? '') +
		header.text +
		newline +
		body +
		trailing +
		source.slice(slot.end)
	)
}

const insertNote = (source: string, block: QuestionBlock, note: string): string => {
	if (note.trim() === '') throw new AnswerError({ message: 'Type a note before saving.' })

	const slot = block.slots[0]
	const lines = sourceLines(source)
	const header = lines[slot.line]

	if (header === undefined)
		throw new AnswerError({ message: 'The question is unavailable; your draft is kept.' })

	const newline = lineEnding(lines, header)
	const ended = slot.source.endsWith(newline)
	const separator = slot.prefix + newline

	const body = note
		.replace(/\r\n|\r/g, '\n')
		.split('\n')
		.map((text) => slot.prefix + ' > ' + text)
		.join(newline)

	const trailing = ended || slot.end < source.length ? newline : ''

	return (
		source.slice(0, slot.end) +
		(ended ? '' : newline) +
		separator +
		slot.prefix +
		' > [!note]' +
		newline +
		body +
		trailing +
		source.slice(slot.end)
	)
}

const insertFieldNote = (
	source: string,
	block: QuestionBlock,
	field: AnswerField,
	text: string,
): string => {
	if (field === 'note') return insertNote(source, block, text)

	if (field.startsWith('option:')) return insertOptionNote(source, block, field, text)
	throw new AnswerError({ message: 'The answer callout is missing; your draft is kept.' })
}
