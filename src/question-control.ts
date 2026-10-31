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
	private readonly notes: HTMLElement[]
	private readonly metadata: HTMLElement

	constructor(box: HTMLElement, block: QuestionBlock, actions: ControlActions) {
		this.box = box
		this.block = block
		this.actions = actions
		this.content =
			box.querySelector<HTMLElement>(':scope > .callout-content') ??
			box.appendChild(box.ownerDocument.createElement('div'))
		this.content.classList.add('callout-content')
		this.original = Array.from(this.content.childNodes)
		this.notes = Array.from(
			this.content.querySelectorAll<HTMLElement>(':scope > .callout[data-callout="note"]'),
		)
		this.metadata = box.ownerDocument.createElement('span')
		this.metadata.className = 'answer-meta'
	}

	load(): void {
		this.box.classList.add('answer-question')
		this.addMetadata()
		this.content.classList.add('answer-body')

		if (canAnnotate(this.block) && this.block.notes.length === 1 && this.notes.length === 0) {
			const note = this.noteCallout()
			this.addNoteBody(note)
			this.notes.push(note)
		}

		if (canEdit(this.block))
			this.mount(
				this.box,
				answerTarget(this.block),
				{
					...this.actions,
					addNote:
						this.block.notes.length === 0
							? (): void => this.actions.modal(this.actions.draft(answerTarget(this.block, 'note')))
							: undefined,
				},
				this.notes,
			)

		if (canAnnotate(this.block) && this.block.notes.length === 1) this.addNote()
	}

	private addMetadata(): void {
		const title = this.box.querySelector(':scope > .callout-title')

		if (title === null) return

		const status = title.querySelector(':scope > .answer-status')

		if (status !== null) this.metadata.append(status)

		title.append(this.metadata)
	}

	private noteCallout(): HTMLElement {
		const source = this.notes[0]

		if (source !== undefined) {
			source.classList.add('answer-note')

			return source
		}

		const callout = this.box.ownerDocument.createElement('div')
		callout.classList.add('callout', 'answer-note')
		callout.setAttribute('data-callout', 'note')
		const heading = this.box.ownerDocument.createElement('div')
		heading.className = 'callout-title'
		const label = this.box.ownerDocument.createElement('div')
		label.className = 'callout-title-inner'
		label.textContent = 'Note'
		heading.append(label)
		callout.append(heading)

		return callout
	}

	private addNote(): void {
		const callout = this.noteCallout()

		if (callout.querySelector(':scope > .callout-content') === null) this.addNoteBody(callout)
		this.content.append(callout)
		this.mount(callout, answerTarget(this.block, 'note'), {
			...this.actions,
			state: (): void => {},
		})
	}

	private addNoteBody(callout: HTMLElement): void {
		const body = this.box.ownerDocument.createElement('div')
		body.className = 'callout-content'
		const note = this.block.notes[0]?.content

		if (note?.kind === 'text' && note.text !== '') {
			const text = this.box.ownerDocument.createElement('p')
			text.className = 'answer-note-text'
			text.textContent = note.text
			body.append(text)
		}

		callout.append(body)
	}

	private mount(
		element: HTMLElement,
		target: ReturnType<typeof answerTarget>,
		actions: ControlActions,
		preserved: readonly Node[] = [],
	): void {
		const draft = this.actions.draft(target)
		const control = new AnswerControl(element, draft, actions, preserved)
		this.controls.push(control)
		control.load()
	}

	unload(): void {
		for (const control of this.controls) control.unload()
		this.content.replaceChildren(...this.original)

		for (const note of this.notes) note.classList.remove('answer-note')

		this.metadata.remove()
		this.box.classList.remove('answer-question')
		this.content.classList.remove('answer-body')
	}
}
