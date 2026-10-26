import type { Nodes } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'

const plainText = (node: Nodes): string => {
	if ('children' in node) return node.children.map(plainText).join('')

	if ('value' in node) return node.value

	if (node.type === 'image') return node.alt ?? ''

	if (node.type === 'break') return ' '

	return ''
}

const wikiLabel = (_match: string, target: string): string => {
	const alias = target.split('|').at(-1) ?? target

	return alias.split('/').at(-1) ?? alias
}

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim()

export const questionLabel = (markdown: string): string =>
	normalize(plainText(fromMarkdown(markdown.replace(/\[\[([^\]\n]+)\]\]/g, wikiLabel))))

/** Read only the question title, never descendant answers, notes or kind badges. */
export const renderedQuestionLabel = (callout: HTMLElement): string =>
	normalize(
		callout.querySelector(':scope > .callout-title > .callout-title-inner')?.textContent ?? '',
	)
