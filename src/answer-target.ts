import { choiceReplacement } from '#/src/choice-replacement'
import { lineEnding, sourceLines } from '#/src/markdown-lines'
import {
	canEdit,
	canAnnotate,
	type AnswerSlot,
	type QuestionBlock,
	questionBlocks,
} from '#/src/question-blocks'
import { AnswerError } from '#/src/write-error'

export { AnswerError } from '#/src/write-error'

export interface AnswerTarget {
	readonly question: string
	readonly context: string
	readonly answer: AnswerSlot | undefined
	readonly field: 'answer' | 'note'
}

const fieldSlots = (block: QuestionBlock, field: 'answer' | 'note'): readonly AnswerSlot[] =>
	field === 'note' ? block.notes : block.slots

const editableField = (block: QuestionBlock, field: 'answer' | 'note'): boolean => {
	if (field === 'answer') return canEdit(block)

	return canAnnotate(block)
}

export const answerTarget = (
	block: QuestionBlock,
	field: 'answer' | 'note' = 'answer',
): AnswerTarget => {
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
	field: 'answer' | 'note' = 'answer',
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
			message: 'The question is completed or ambiguous; your draft is kept.',
		})

	const slot = fieldSlots(block, target.field)[0]

	if (slot?.source !== target.answer?.source)
		throw new AnswerError({ message: 'The answer changed; your draft is kept.' })

	return block
}

/** Runs synchronously inside Vault.process, never against a remembered line number. */
export const writeAnswer = (source: string, target: AnswerTarget, answer: string): string => {
	if (target.field === 'answer' && answer.trim() === '')
		throw new AnswerError({ message: 'Type an answer before saving.' })
	const block = matchTarget(source, target)
	const slot = target.field === 'note' ? block.notes[0] : block.slots[0]

	if (slot === undefined && target.field === 'note') return insertSideNote(source, block, answer)

	if (slot === undefined)
		throw new AnswerError({ message: 'The answer callout is missing; your draft is kept.' })

	return replaceSlot(source, slot, answer)
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

const questionPrefix = (text: string): string => {
	const marker = /^([ \t]*)([-+*]|\d+[.)])([ \t]+)/.exec(text)

	if (marker === null)
		throw new AnswerError({ message: 'The question indentation changed; your draft is kept.' })

	return (marker[1] ?? '') + ' '.repeat((marker[2] ?? '').length) + (marker[3] ?? ' ') + '>'
}

const insertSideNote = (source: string, block: QuestionBlock, text: string): string => {
	const slot = block.slots[0]

	if (slot !== undefined) return appendNestedNote(source, slot, text)
	const lines = sourceLines(source)
	const first = lines[block.line]
	const last = lines[block.endLine]

	if (first === undefined || last === undefined)
		throw new AnswerError({ message: 'The question is missing; your draft is kept.' })
	const prefix = questionPrefix(first.text)
	const newline = lineEnding(lines, first)
	const end = last.offset + last.text.length + last.ending.length
	const leading = last.ending === '' ? newline + newline : newline
	const body = noteBody(prefix, text, newline)

	return (
		source.slice(0, end) +
		leading +
		prefix +
		' [!answer]' +
		newline +
		prefix +
		newline +
		body +
		last.ending +
		source.slice(end)
	)
}

const noteBody = (prefix: string, text: string, newline: string): string =>
	prefix +
	' > [!note]' +
	newline +
	text
		.replace(/\r\n|\r/g, '\n')
		.split('\n')
		.map((line) => prefix + ' > ' + line)
		.join(newline)

const appendNestedNote = (source: string, slot: AnswerSlot, text: string): string => {
	const lines = sourceLines(slot.source)
	const header = lines[0]

	if (header === undefined)
		throw new AnswerError({ message: 'The answer callout is missing; your draft is kept.' })
	const newline = lineEnding(lines, header)
	const ending = lines.at(-1)?.ending ?? ''
	const separator = ending === '' ? newline : ''

	return (
		source.slice(0, slot.end) +
		separator +
		slot.prefix +
		newline +
		noteBody(slot.prefix, text, newline) +
		ending +
		source.slice(slot.end)
	)
}
