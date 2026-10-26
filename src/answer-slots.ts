import type { Blockquote } from 'mdast'

import {
	answerContent,
	isAnswered,
	type AnswerContent,
	type AnswerKind,
} from '#/src/answer-content'
import type { SourceLine } from '#/src/markdown-lines'
import type { AnswerSlot } from '#/src/question-blocks'

const questionHeader = /^(\s*>)[ \t]*\[!question(?:\|([^\]\r\n]*))?\](?:[+-])?(?:[ \t]+[^\r\n]*)?$/i

const answerKind = (metadata: string | undefined): AnswerKind | undefined => {
	switch (metadata?.toLowerCase()) {
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

const slotContent = (
	metadata: string | undefined,
	lines: readonly SourceLine[],
): AnswerContent | undefined => {
	const kind = answerKind(metadata)

	if (kind === undefined) return undefined

	if (kind !== 'text' && lines.some((line) => !/^[ \t]*>/.test(line.text))) return undefined
	const body = lines.map((entry) => entry.text.replace(/^[ \t]*>[ \t]?/, '')).join('\n')

	return answerContent(kind, body)
}

export const calloutSlot = (
	node: Blockquote,
	lines: readonly SourceLine[],
): AnswerSlot | undefined => {
	if (node.position === undefined) return undefined
	const line = node.position.start.line - 1
	const header = lines[line]

	if (header === undefined) return undefined

	const match = questionHeader.exec(header.text)

	if (match === null) return undefined
	const last = lines[node.position.end.line - 1]

	if (last === undefined) return undefined
	const content = slotContent(match[2], lines.slice(line + 1, node.position.end.line))

	return {
		line,
		start: header.offset,
		end: last.offset + last.text.length + last.ending.length,
		prefix: match[1] ?? '>',
		blank: content !== undefined && !isAnswered(content),
		source: lines
			.slice(line, node.position.end.line)
			.map((entry) => entry.text + entry.ending)
			.join(''),
		content,
	}
}
