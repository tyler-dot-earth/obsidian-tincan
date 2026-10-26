import type { Blockquote, ListItem, Nodes } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter'
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item'
import { frontmatter } from 'micromark-extension-frontmatter'
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item'

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
	readonly completed: boolean
	readonly context: string | undefined
	readonly slots: readonly AnswerSlot[]
	readonly notes: readonly AnswerSlot[]
}

const questionText = (item: ListItem, source: string): string => {
	const paragraph = item.children[0]

	if (paragraph?.type !== 'paragraph') return ''

	return source.slice(paragraph.position?.start.offset, paragraph.position?.end.offset).trim()
}

/** The recommendation marker belongs inside an answer, never in question context. */
const contextLists = (item: ListItem, source: string): boolean =>
	!questionText(item, source).startsWith('🤖') &&
	item.children.every(
		(child) =>
			child.type !== 'list' ||
			child.children.every((entry) => !questionText(entry, source).startsWith('🤖')),
	)

const blockFrom = (
	item: ListItem,
	source: string,
	lines: readonly SourceLine[],
): QuestionBlock | undefined => {
	if (item.checked === null || item.checked === undefined || item.position === undefined)
		return undefined
	const line = item.position.start.line - 1
	const endLine = item.position.end.line - 1

	const fields = item.children.flatMap((child) => {
		if (child.type !== 'blockquote') return []
		const slot = calloutSlot(child, lines, 'answer')

		return slot === undefined ? [] : [splitNestedNotes(slot, child, lines)]
	})

	const slots = fields.map((field) => field.answer)
	const notes = fields.flatMap((field) => field.notes)

	const context = lines
		.slice(line, endLine + 1)
		.flatMap((entry) =>
			[...slots, ...notes].some((slot) => entry.offset >= slot.start && entry.offset < slot.end)
				? []
				: [entry.text],
		)
		.join('\n')
		.trimEnd()

	return {
		question: questionText(item, source),
		line,
		endLine,
		completed: item.checked,
		context:
			fields.length === item.children.filter((child) => child.type === 'blockquote').length &&
			contextLists(item, source)
				? context
				: undefined,
		slots,
		notes,
	}
}

const questionTitle = (header: string): string | undefined =>
	/\[!question(?:\|[^\]]*)?\][+-]?[ \t]+(\S.*)$/i.exec(header)?.[1]?.trim()

const calloutFrom = (node: Blockquote, lines: readonly SourceLine[]): QuestionBlock | undefined => {
	const slot = calloutSlot(node, lines, 'question')

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
		completed: false,
		context: supported ? header.trimEnd() : undefined,
		slots: [fields.answer],
		notes: fields.notes,
	}
}

const collectBlocks = (
	node: Nodes,
	source: string,
	blocks: QuestionBlock[],
	lines: readonly SourceLine[],
): void => {
	if (node.type !== 'root' && node.type !== 'list' && node.type !== 'listItem') return

	if (node.type === 'listItem') {
		const block = blockFrom(node, source, lines)

		if (block !== undefined) blocks.push(block)
	}

	for (const child of node.children) collectBlocks(child, source, blocks, lines)
}

/** Syntax tree traversal excludes metadata, code, HTML, and quoted/embedded questions. */
export const questionBlocks = (source: string): QuestionBlock[] => {
	const tree = fromMarkdown(source, {
		extensions: [frontmatter(['yaml', 'toml']), gfmTaskListItem()],
		mdastExtensions: [frontmatterFromMarkdown(['yaml', 'toml']), gfmTaskListItemFromMarkdown()],
	})

	const blocks: QuestionBlock[] = []
	const lines = sourceLines(source)

	for (const child of tree.children) {
		if (child.type === 'blockquote') {
			const block = calloutFrom(child, lines)

			if (block !== undefined) blocks.push(block)
		} else collectBlocks(child, source, blocks, lines)
	}

	return blocks
}

export const canAnswer = (block: QuestionBlock): boolean =>
	canEdit(block) && block.slots[0]?.blank === true

export const canEdit = (block: QuestionBlock): boolean =>
	block.context !== undefined && block.slots.length === 1 && block.slots[0]?.content !== undefined

export const canAnnotate = (block: QuestionBlock): boolean =>
	block.context !== undefined &&
	block.slots.length <= 1 &&
	block.notes.length === 1 &&
	block.notes.every((note) => note.content?.kind === 'text')
