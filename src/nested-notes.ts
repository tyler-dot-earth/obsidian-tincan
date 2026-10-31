import type { Blockquote } from 'mdast'

import { answerContent, isAnswered, type AnswerKind } from '#/src/answer-content'
import type { SourceLine } from '#/src/markdown-lines'
import type { AnswerSlot } from '#/src/question-blocks'

export interface AnswerFields {
	readonly answer: AnswerSlot
	readonly notes: readonly AnswerSlot[]
	readonly valid: boolean
}

const noteHeader = /^([ \t]*>[ \t]*>)[ \t]*\[!note\](?:[+-])?(?:[ \t]+[^\r\n]*)?$/i

const leadingBefore = (lines: readonly SourceLine[], line: number): string => {
	const previous = lines[line - 1]

	return previous !== undefined && /^[ \t]*>[ \t]*$/.test(previous.text)
		? previous.text + previous.ending
		: ''
}

export const noteSlot = (
	node: Blockquote,
	lines: readonly SourceLine[],
): AnswerSlot | undefined => {
	if (node.position === undefined) return undefined
	const line = node.position.start.line - 1
	const header = lines[line]
	const last = lines[node.position.end.line - 1]

	if (header === undefined || last === undefined) return undefined
	const match = noteHeader.exec(header.text)

	if (match === null) return undefined
	const leading = leadingBefore(lines, line)

	const bodyLines = lines.slice(line + 1, node.position.end.line)
	const body = bodyLines.map((entry) => entry.text.replace(/^[ \t]*>[ \t]*>[ \t]?/, '')).join('\n')

	const supported = bodyLines.every(
		(entry) => /^[ \t]*>[ \t]*>/.test(entry.text) && !noteHeader.test(entry.text),
	)

	return {
		line,
		start: header.offset - leading.length,
		end: last.offset + last.text.length + last.ending.length,
		prefix: match[1] ?? '> >',
		blank: body.trim() === '',
		source:
			leading +
			lines
				.slice(line, node.position.end.line)
				.map((entry) => entry.text + entry.ending)
				.join(''),
		content: supported ? { kind: 'text', text: body } : undefined,
		leading,
	}
}

const nestedKind = (source: string): AnswerKind | undefined => {
	const header = /\[!question(?:\|([^\]]*))?\]/i.exec(source)?.[1]?.toLowerCase()

	switch (header) {
		case undefined:
			return 'text'
		case 'choice':
			return 'choice'
		case 'choices':
			return 'choices'
		default:
			return undefined
	}
}

/** A trailing, direct nested note is a separate field, never part of the answer payload. */
export const splitNestedNotes = (
	slot: AnswerSlot,
	node: Blockquote,
	lines: readonly SourceLine[],
): AnswerFields => {
	const notes = node.children.flatMap((child) => {
		if (child.type !== 'blockquote') return []
		const note = noteSlot(child, lines)

		return note === undefined ? [] : [note]
	})

	const first = notes[0]

	if (first === undefined) return { answer: slot, notes, valid: true }
	const source = slot.source.slice(0, first.start - slot.start)

	const body = lines
		.slice(slot.line + 1, first.line - (first.leading === '' ? 0 : 1))
		.map((entry) => entry.text.replace(/^[ \t]*>[ \t]?/, ''))
		.join('\n')

	const kind = nestedKind(slot.source)
	const content = kind === undefined ? undefined : answerContent(kind, body)
	const valid = notes.length === 1 && first.end === slot.end

	return {
		answer: {
			...slot,
			end: first.start,
			source,
			content: valid ? content : undefined,
			blank: content !== undefined && !isAnswered(content),
		},
		notes,
		valid,
	}
}
