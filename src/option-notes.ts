import type { Blockquote, ListItem } from 'mdast'

import { answerContent, isAnswered } from '#/src/answer-content'
import type { SourceLine } from '#/src/markdown-lines'
import { noteSlot } from '#/src/nested-notes'
import type { AnswerSlot } from '#/src/question-blocks'

export interface OptionNotes {
	readonly label: string
	readonly line: number
	readonly notes: readonly AnswerSlot[]
}

interface OptionFields {
	readonly answer: AnswerSlot
	readonly notes: readonly OptionNotes[]
}

const withoutNotes = (
	lines: readonly SourceLine[],
	slot: AnswerSlot,
	spans: readonly AnswerSlot[],
): SourceLine[] =>
	lines.filter(
		(line, index) =>
			index > slot.line &&
			line.offset < slot.end &&
			!spans.some((note) => line.offset >= note.start && line.offset < note.end),
	)

const optionNotes = (item: ListItem, lines: readonly SourceLine[]): OptionNotes | undefined => {
	const line = (item.position?.start.line ?? 0) - 1
	const label = /^[ \t]*>[ \t]?- \[[ xX]\] (\S.*)$/.exec(lines[line]?.text ?? '')?.[1]

	if (label === undefined) return undefined

	const notes = item.children.flatMap((child) => {
		if (child.type !== 'blockquote') return []
		const note = noteSlot(child, lines)

		return note === undefined ? [] : [note]
	})

	return { label, line, notes }
}

/** Only direct note callouts inside top-level task items are option annotations. */
export const splitOptionNotes = (
	slot: AnswerSlot,
	node: Blockquote,
	lines: readonly SourceLine[],
): OptionFields => {
	const kind = /\[!question\|(choice|choices)\]/i.exec(slot.source)?.[1]?.toLowerCase()

	if (kind !== 'choice' && kind !== 'choices') return { answer: slot, notes: [] }

	const notes = node.children.flatMap((child) =>
		child.type === 'list'
			? child.children.flatMap((item) => {
					const option = optionNotes(item, lines)

					return option === undefined ? [] : [option]
				})
			: [],
	)

	const spans = notes.flatMap((option) => option.notes)

	const bodyLines = withoutNotes(lines, slot, spans)

	const body = bodyLines.map((line) => line.text.replace(/^[ \t]*>[ \t]?/, '')).join('\n')
	const parsed = answerContent(kind, body)

	const valid = notes.every(
		(option) =>
			option.notes.length <= 1 && option.notes.every((note) => note.content !== undefined),
	)

	const content = valid ? parsed : undefined
	const header = lines[slot.line]

	if (header === undefined) return { answer: slot, notes: [] }

	const identity =
		header.text + header.ending + bodyLines.map((line) => line.text + line.ending).join('')

	return {
		answer: {
			...slot,
			content,
			blank: content !== undefined && !isAnswered(content),
			identity: identity.replace(/\r?\n$/, ''),
		},
		notes,
	}
}
