import type { Draft } from '#/src/drafts'

export interface EditorInput {
	readonly capture: () => void
	readonly refresh: () => void
	readonly focus: () => void
}

export const mountTextInput = (container: HTMLElement, draft: Draft): EditorInput => {
	const textarea = container.ownerDocument.createElement('textarea')
	textarea.className = 'answer-input'
	textarea.setAttribute(
		'aria-label',
		`${draft.target.field === 'answer' ? 'Answer' : 'Side note'}: ${draft.target.question}${draft.target.field.startsWith('option:') ? ' / ' + draft.target.field.slice(7) : ''}`,
	)
	textarea.placeholder =
		draft.target.field !== 'answer'
			? 'Type your note in Markdown…'
			: 'Type your answer in Markdown…'
	textarea.rows = 5
	textarea.value = draft.text
	container.append(textarea)

	const capture = (): void => {
		draft.text = textarea.value
		draft.selectionStart = textarea.selectionStart
		draft.selectionEnd = textarea.selectionEnd
	}

	textarea.addEventListener('input', () => {
		capture()
		draft.notify()
	})
	textarea.addEventListener('select', capture)
	textarea.addEventListener('focus', () => {
		draft.wantsFocus = true
	})
	textarea.addEventListener('blur', () => {
		capture()

		// DOM removal can blur an input before the render child is unloaded.
		if (textarea.isConnected) draft.wantsFocus = false
	})

	return {
		capture,
		refresh: () => {
			if (textarea.value !== draft.text) textarea.value = draft.text
			textarea.disabled = draft.saving || draft.saved
		},
		focus: () => {
			textarea.focus({ preventScroll: true })
			textarea.setSelectionRange(draft.selectionStart, draft.selectionEnd)
		},
	}
}
