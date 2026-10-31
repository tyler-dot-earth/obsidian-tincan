import { type App, Modal } from 'obsidian'

import type { DiscardConfirmation } from '#/src/confirm-discard'

export class DiscardModal extends Modal {
	private accepted = false
	private readonly request: DiscardConfirmation
	private readonly settled: (accepted: boolean) => void
	constructor(app: App, request: DiscardConfirmation, settled: (accepted: boolean) => void) {
		super(app)
		this.request = request
		this.settled = settled
	}
	override onOpen(): void {
		this.titleEl.textContent = this.request.title
		this.contentEl.createEl('p', { text: this.request.description })
		this.contentEl.createEl('blockquote', {
			text: this.request.text,
			cls: 'answer-discard-preview',
		})
		const buttons = this.contentEl.createDiv({ cls: 'modal-button-container' })
		const cancel = buttons.createEl('button', { text: 'Cancel' })
		cancel.addEventListener('click', () => this.close())
		const confirm = buttons.createEl('button', { text: this.request.action, cls: 'mod-warning' })
		confirm.addEventListener('click', () => {
			this.accepted = true
			this.close()
		})

		cancel.focus()
	}
	override onClose(): void {
		this.settled(this.accepted)
	}
}
