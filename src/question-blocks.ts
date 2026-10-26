import type { Blockquote } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter'
import { frontmatter } from 'micromark-extension-frontmatter'

import type { AnswerContent } from '#/src/answer-content'
import { calloutSlot } from '#/src/answer-slots'
import { sourceLines, type SourceLine } from '#/src/markdown-lines'
import { splitNestedNotes } from '#/src/nested-notes'

export interface AnswerSlot {
	readonly line: number
	readonly start: number
	readonly end: number
	readonly prefix: string
	readonly blank: boolean
	readonly source: string
	readonly content: AnswerContent | undefined
	readonly leading?: string
}

export interface QuestionBlock {
	readonly question: string
	readonly line: number
	readonly endLine: number
	readonly context: string | undefined
	readonly slots: readonly [AnswerSlot]
	readonly notes: readonly AnswerSlot[]
}

const questionTitle = (header: string): string | undefined =>
	/\[!question(?:\|[^\]]*)?\][+-]?[ \t]+(\S.*)$/i.exec(header)?.[1]?.trim()

const calloutFrom = (node: Blockquote, lines: readonly SourceLine[]): QuestionBlock | undefined => {
	const slot = calloutSlot(node, lines)

	if (slot === undefined) return undefined
	const header = lines[slot.line]?.text ?? ''
	const question = questionTitle(header)

	if (question === undefined) return undefined

	const fields = splitNestedNotes(slot, node, lines)

	const endLine = slot.line + sourceLines(slot.source).length - 1

	const supported = lines
		.slice(slot.line + 1, endLine + 1)
		.every(
			(line) =>
				/^[ \t]*>/.test(line.text) && !/^[ \t]*>[ \t]*\[!question(?:\||\])/i.test(line.text),
		)

	return {
		question,
		line: slot.line,
		endLine,
		context: supported ? header.trimEnd() : undefined,
		slots: [fields.answer],
		notes: fields.notes,
	}
}

/** Syntax tree traversal excludes metadata, code, HTML, and quoted/embedded questions. */
export const questionBlocks = (source: string): QuestionBlock[] => {
	const tree = fromMarkdown(source, {
		extensions: [frontmatter(['yaml', 'toml'])],
		mdastExtensions: [frontmatterFromMarkdown(['yaml', 'toml'])],
	})

	const blocks: QuestionBlock[] = []
	const lines = sourceLines(source)

	for (const child of tree.children) {
		if (child.type === 'blockquote') {
			const block = calloutFrom(child, lines)

			if (block !== undefined) blocks.push(block)
		}
	}

	return blocks
}

export const canAnswer = (block: QuestionBlock): boolean => canEdit(block) && block.slots[0].blank

export const canEdit = (block: QuestionBlock): boolean =>
	block.context !== undefined && block.slots[0].content !== undefined

export const canAnnotate = (block: QuestionBlock): boolean =>
	block.context !== undefined &&
	block.notes.length === 1 &&
	block.notes.every((note) => note.content?.kind === 'text')
