import type { Draft } from '#/src/drafts'
import { mountTextInput } from '#/src/editor-input'

export interface EditorActions {
	readonly save: () => Promise<boolean>
	readonly modal: (() => void) | undefined
	readonly done: () => void
}

const button = (container: HTMLElement, label: string, action: () => void): HTMLButtonElement => {
	const element = container.ownerDocument.createElement('button')
	element.type = 'button'
	element.textContent = label
	element.addEventListener('click', action)
	container.append(element)

	return element
}

const stop = (event: Event): void => event.stopPropagation()

/** Plain DOM here keeps the editor testable without impersonating the Obsidian runtime. */
export const mountEditor = (
	container: HTMLElement,
	draft: Draft,
	actions: EditorActions,
): (() => void) => {
	const input = mountTextInput(container, draft)

	const controls = container.ownerDocument.createElement('div')
	controls.className = 'answer-controls'
	container.append(controls)

	const save = button(controls, 'Done', () => {
		input.capture()
		void actions.save().then((saved) => {
			if (saved) actions.done()

			return saved
		})
	})

	save.className = 'mod-cta'

	const cancel = button(controls, 'Cancel', () => {
		input.capture()
		draft.editing = false
		draft.wantsFocus = false
		draft.notify()
		actions.done()
	})

	const modal = actions.modal

	if (modal !== undefined)
		button(controls, 'Open in popup', () => {
			input.capture()
			modal()
		})

	const refresh = (): void => {
		input.refresh()
		save.disabled = draft.saving || draft.saved
		cancel.disabled = draft.saving
	}

	const unsubscribe = draft.subscribe(refresh)

	for (const name of ['click', 'dblclick', 'pointerdown', 'keydown', 'input', 'change'])
		container.addEventListener(name, stop)
	refresh()

	if (draft.wantsFocus) input.focus()

	return () => {
		unsubscribe()

		for (const name of ['click', 'dblclick', 'pointerdown', 'keydown', 'input', 'change'])
			container.removeEventListener(name, stop)
	}
}
