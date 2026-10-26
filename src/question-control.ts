import { AnswerControl, type ControlActions } from '#/src/answer-control'
import { answerTarget } from '#/src/answer-target'
import { canAnnotate, canEdit, type QuestionBlock } from '#/src/question-blocks'

/** One DOM owner for the answer and its note; neither disposable child owns the other's source. */
export class QuestionControl {
	private readonly box: HTMLElement
	private readonly block: QuestionBlock
	private readonly actions: ControlActions
	private readonly original: Node[]
	private readonly content: HTMLElement
	private readonly controls: AnswerControl[] = []
	private readonly hidden = new Map<HTMLElement, HTMLElement['hidden']>()
	private readonly badge: HTMLElement

	constructor(box: HTMLElement, block: QuestionBlock, actions: ControlActions) {
		this.box = box
		this.block = block
		this.actions = actions
		this.content =
			box.querySelector<HTMLElement>(':scope > .callout-content') ??
			box.appendChild(box.ownerDocument.createElement('div'))
		this.content.classList.add('callout-content')
		this.original = Array.from(this.content.childNodes)
		this.badge = box.ownerDocument.createElement('span')
		this.badge.className = 'answer-kind'
	}

	load(): void {
		this.box.classList.add('answer-question')
		this.hideSourceNotes()
		this.addKind()
		const answer = this.box.ownerDocument.createElement('div')
		answer.className = 'answer-body'
		const body = this.box.ownerDocument.createElement('div')
		body.className = 'callout-content'

		if (this.block.slots.length !== 0)
			body.append(
				...this.original.filter(
					(node) => !Array.from(this.hidden.keys()).some((note) => note === node),
				),
			)
		answer.append(body)
		this.content.replaceChildren(answer)

		if (canEdit(this.block)) this.mount(answer, answerTarget(this.block), this.actions)

		if (canAnnotate(this.block)) this.addNote()
	}

	private hideSourceNotes(): void {
		for (const note of this.content.querySelectorAll<HTMLElement>(
			':scope > .callout[data-callout="note"]',
		)) {
			this.hidden.set(note, note.hidden)
			note.classList.add('answer-source-hidden')
			note.hidden = true
		}
	}

	private addKind(): void {
		const kind = this.block.slots[0]?.content?.kind

		if (kind === undefined || kind === 'text') return
		this.badge.textContent = kind === 'choice' ? 'pick 1' : 'pick 1+'
		this.box.querySelector(':scope > .callout-title')?.append(this.badge)
	}

	private addNote(): void {
		const area = this.box.ownerDocument.createElement('div')
		area.className = 'answer-note'
		const body = this.box.ownerDocument.createElement('div')
		body.className = 'callout-content'
		const note = this.block.notes[0]?.content

		if (note?.kind === 'text' && note.text !== '') {
			const text = this.box.ownerDocument.createElement('div')
			text.className = 'answer-note-text'
			text.textContent = note.text
			body.append(text)
		}

		area.append(body)
		this.content.append(area)
		// A note cannot recolor the containing answer or replace its icon.
		this.mount(area, answerTarget(this.block, 'note'), { ...this.actions, state: (): void => {} })
	}

	private mount(
		element: HTMLElement,
		target: ReturnType<typeof answerTarget>,
		actions: ControlActions,
	): void {
		const draft = this.actions.draft(target)
		const control = new AnswerControl(element, draft, actions)
		this.controls.push(control)
		control.load()
	}

	unload(): void {
		for (const control of this.controls) control.unload()
		this.content.replaceChildren(...this.original)

		for (const [note, hidden] of this.hidden) {
			note.hidden = hidden
			note.classList.remove('answer-source-hidden')
		}

		this.badge.remove()
		this.box.classList.remove('answer-question')
	}
}
