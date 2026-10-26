import type { Blockquote, ListItem, Nodes } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter'
import { gfmTaskListItemFromMarkdown } from 'mdast-util-gfm-task-list-item'
import { frontmatter } from 'micromark-extension-frontmatter'
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item'

import {
	answerContent,
	type AnswerContent,
	type AnswerKind,
	isAnswered,
} from '#/src/answer-content'
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

const slotAt = (node: Blockquote, lines: readonly SourceLine[]): AnswerSlot | undefined => {
	if (node.position === undefined) return undefined
	const line = node.position.start.line - 1
	const header = lines[line]

	if (header === undefined) return undefined

	const match = /^(\s*>)[ \t]*\[!answer(?:\|([^\]\r\n]*))?\](?:[+-])?(?:[ \t]+[^\r\n]*)?$/i.exec(
		header.text,
	)

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
		const slot = slotAt(child, lines)

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
	collectBlocks(tree, source, blocks, sourceLines(source))

	return blocks
}

export const canAnswer = (block: QuestionBlock): boolean =>
	canEdit(block) && block.slots[0]?.blank === true

export const canEdit = (block: QuestionBlock): boolean =>
	block.context !== undefined && block.slots.length === 1 && block.slots[0]?.content !== undefined

export const canAnnotate = (block: QuestionBlock): boolean =>
	block.context !== undefined &&
	block.slots.length <= 1 &&
	block.notes.length <= 1 &&
	block.notes.every((note) => note.content?.kind === 'text')
