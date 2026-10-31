import { QuestionAppearance } from '#/src/answer-appearance'
import { otherCallout, type OtherActions } from '#/src/other-control'
import type { QuestionBlock } from '#/src/question-blocks'

/** Presentation only: native task inputs and their source-writing handlers stay intact. */
export class NativeQuestion {
	private readonly cleanup: (() => void)[] = []
	private readonly owned: HTMLElement[] = []
	private readonly box: HTMLElement

	constructor(box: HTMLElement, block: QuestionBlock, renderIcon: OtherActions['renderIcon']) {
		this.box = box
		const content = block.slots[0].content
		box.classList.add('answer-question', 'answer-native')
		const appearance = new QuestionAppearance(box, renderIcon)
		appearance.paint(content)
		const status = box.querySelector<HTMLElement>(':scope > .callout-title > .answer-status')

		if (status !== null) this.owned.push(status)
		this.cleanup.push(() => {
			appearance.unload()
			box.classList.remove('answer-question', 'answer-native')
		})

		if (content === undefined || content.kind === 'text') return
		const list = box.querySelector<HTMLElement>(':scope > .callout-content > ul')

		if (list === null) return
		this.choices(list, content.kind)
		const body = box.querySelector<HTMLElement>(':scope > .callout-content')

		const other = content.other ?? ''

		if (body !== null && other.trim() !== '') this.other(body, other, renderIcon)
	}

	private choices(list: HTMLElement, kind: 'choice' | 'choices'): void {
		list.classList.add('answer-choice-list')
		const hint = list.ownerDocument.createElement('li')
		hint.className = 'answer-choice-item answer-instruction'
		hint.setAttribute('role', 'presentation')
		const text = list.ownerDocument.createElement('span')
		text.className = 'answer-kind'
		text.textContent = kind === 'choice' ? 'pick 1' : 'pick 1+'
		hint.append(text)
		this.owned.push(hint)
		const items = Array.from(list.children)

		for (const item of items) this.option(item)
		list.prepend(hint)
		this.cleanup.push(() => {
			hint.remove()
			list.classList.remove('answer-choice-list')
		})
	}

	private option(item: Element): void {
		const original = Array.from(item.childNodes)
		const row = item.ownerDocument.createElement('div')
		row.className = 'answer-option-row'
		const label = item.ownerDocument.createElement('div')
		label.className = 'answer-option'
		const text = item.ownerDocument.createElement('span')

		for (const node of original) {
			if (node instanceof HTMLElement && node.matches('.callout[data-callout="note"]')) {
				node.classList.add('answer-note', 'answer-option-note')
				this.cleanup.push(() => node.classList.remove('answer-note', 'answer-option-note'))
			} else if (node instanceof HTMLInputElement) label.append(node)
			else text.append(node)
		}

		label.append(text)
		row.append(label)
		item.prepend(row)
		this.owned.push(row)
		this.cleanup.push(() => {
			if (row.parentNode === item) item.replaceChildren(...original)
		})
	}

	private other(body: HTMLElement, text: string, renderIcon: OtherActions['renderIcon']): void {
		const paragraph = Array.from(body.children).find(
			(element) => element.matches('p') && element.textContent.startsWith('Other:'),
		)

		if (paragraph === undefined) return
		const original: ChildNode[] = []
		let node: ChildNode | null = paragraph

		while (
			node !== null &&
			!(node instanceof HTMLElement && node.matches('.callout[data-callout="note"]'))
		) {
			original.push(node)
			node = node.nextSibling
		}

		const { callout, body: inner } = otherCallout(body.ownerDocument, renderIcon)
		paragraph.before(callout)
		const value = body.ownerDocument.createElement('p')
		value.textContent = text
		value.className = 'answer-other-value'
		inner.append(value)

		for (const originalNode of original) originalNode.remove()
		this.owned.push(callout)
		this.cleanup.push(() => {
			callout.before(...original)
			callout.remove()
		})
	}

	intact(): boolean {
		return this.owned.every((node) => this.box.contains(node))
	}

	unload(): void {
		for (const cleanup of this.cleanup.toReversed()) cleanup()
	}
}
