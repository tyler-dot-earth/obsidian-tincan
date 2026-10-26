import { answerContent, type AnswerContent } from '#/src/answer-content'
import { lineEnding, sourceLines } from '#/src/markdown-lines'
import type { AnswerSlot } from '#/src/question-blocks'
import { AnswerError } from '#/src/write-error'

const removeOther = (source: string, start: number, newline: string, ending: string): string => {
	const before = source.slice(0, start)

	return ending === '' && before.endsWith(newline) ? before.slice(0, -newline.length) : before
}

const replaceOther = (source: string, prefix: string, other: string): string => {
	const lines = sourceLines(source)
	const header = lines[0]

	if (header === undefined) return source
	const newline = lineEnding(lines, header)
	const marker = lines.find((line) => /^[ \t]*>[ \t]?Other:(?:[ \t].*)?$/.test(line.text))
	const finalEnding = lines.at(-1)?.ending ?? ''

	const body = other
		.split('\n')
		.map((line, index) => `${prefix} ${index === 0 ? 'Other: ' : ''}${line}`)
		.join(newline)

	if (marker !== undefined)
		return other === ''
			? removeOther(source, marker.offset, newline, finalEnding)
			: source.slice(0, marker.offset) + body + finalEnding

	if (other === '') return source
	const before = source.slice(0, source.length - finalEnding.length)
	const separator = /\n[ \t]*>[ \t]*$/.test(before) ? '' : newline + prefix

	return before + separator + newline + body + finalEnding
}

type PickContent = Exclude<AnswerContent, { readonly kind: 'text' }>

interface ChoiceChange {
	readonly original: PickContent
	readonly content: PickContent
}

const validateChoice = (slot: AnswerSlot, answer: string): ChoiceChange => {
	const original = slot.content

	if (original === undefined || original.kind === 'text')
		throw new AnswerError({ message: 'The choices are unavailable; your draft is kept.' })
	const content = answerContent(original.kind, answer)

	if (content === undefined || content.kind === 'text')
		throw new AnswerError({ message: 'The choices are invalid; your draft is kept.' })

	if (
		content.options.length !== original.options.length ||
		content.options.some((option, index) => option.label !== original.options[index]?.label)
	)
		throw new AnswerError({ message: 'The options changed; your draft is kept.' })

	return { original, content }
}

export const choiceReplacement = (slot: AnswerSlot, answer: string): string => {
	const { original, content } = validateChoice(slot, answer)
	let index = 0

	// Only option lines before Other belong to the pick list.
	const lines = sourceLines(slot.source)
	let inOther = false

	const updated = lines
		.map((line) => {
			if (/^[ \t]*>[ \t]?Other:(?:[ \t].*)?$/.test(line.text)) inOther = true

			if (inOther) return line.text + line.ending

			const text = line.text.replace(
				/^([ \t]*>[ \t]?- \[)[ xX](\])/,
				(match, before: string, after: string) => {
					const checked = content.options[index]?.checked === true
					const unchanged = original.options[index]?.checked === checked
					index += 1

					return unchanged ? match : `${before}${checked ? 'x' : ' '}${after}`
				},
			)

			return text + line.ending
		})
		.join('')

	return (content.other ?? '') === (original.other ?? '')
		? updated
		: replaceOther(updated, slot.prefix, content.other ?? '')
}
