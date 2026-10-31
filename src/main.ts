import { disposePluginRuntime, makePluginRuntime } from '@tyler.earth/effect-obsidian'
import { Effect, Layer, type ManagedRuntime } from 'effect'
import { MarkdownView, Notice, Plugin, type TFile } from 'obsidian'

import { AnswerModal, DraftPicker } from '#/src/answer-modal'
import { AnswerSection, type RenderHost } from '#/src/answer-renderer'
import { targetFor } from '#/src/answer-target'
import { type Draft, Drafts } from '#/src/drafts'
import { answerCallouts } from '#/src/reading-callouts'
import { saveAnswer } from '#/src/save-answer'

export default class AnswerPlugin extends Plugin {
	private readonly drafts = new Drafts<TFile>()
	private runtime: ManagedRuntime.ManagedRuntime<never, never> | undefined
	private readonly modals = new Set<AnswerModal>()
	private readonly sections = new Set<AnswerSection>()

	override onload(): void {
		this.runtime = makePluginRuntime(Layer.empty)

		const host: RenderHost = {
			inReadingView: (element, sourcePath) =>
				this.views().some(
					(view) =>
						view.getMode() === 'preview' &&
						view.file?.path === sourcePath &&
						view.containerEl.contains(element),
				),
			file: (sourcePath) => this.app.vault.getFileByPath(sourcePath),
			draft: (file, target) => this.drafts.get(file, target),
			save: (file, draft) => this.save(file, draft),
			modal: (file, draft) => this.openModal(file, draft),
			released: (section) => {
				this.sections.delete(section)
			},
		}

		this.registerMarkdownPostProcessor((element, context) => {
			if (answerCallouts(element).length === 0) return

			const section = new AnswerSection(element, context, host)
			this.sections.add(section)
			context.addChild(section)
		})
		this.addCommand({
			id: 'resume-draft',
			name: 'Resume draft',
			callback: () => this.resumeDraft(),
		})
	}

	private views(): MarkdownView[] {
		return this.app.workspace
			.getLeavesOfType('markdown')
			.flatMap((leaf) => (leaf.view instanceof MarkdownView ? [leaf.view] : []))
	}

	private openModal(file: TFile, draft: Draft): void {
		const modal = new AnswerModal(
			this.app,
			draft,
			{
				draft: (target): Draft => this.drafts.get(file, target),
				save: (updated): Promise<boolean> => this.save(file, updated),
			},
			(closed) => {
				this.modals.delete(closed)
			},
		)

		this.modals.add(modal)
		modal.open()
	}

	private resumeDraft(): void {
		const pending = this.drafts.pending()

		if (pending.length === 0) {
			new Notice(`${this.manifest.name}: No answer drafts to resume.`)

			return
		}

		new DraftPicker(this.app, pending, ({ file, draft }) => this.openModal(file, draft)).open()
	}

	private async save(file: TFile, draft: Draft): Promise<boolean> {
		const runtime = this.runtime

		if (runtime === undefined || draft.saving || draft.saved) return false
		draft.saving = true
		draft.saveError = undefined
		draft.notify()

		let result = false

		try {
			result = await runtime.runPromise(
				saveAnswer(
					{
						available: () => this.app.vault.getFileByPath(file.path) === file,
						editing: () =>
							this.views().some((view) => view.file === file && view.getMode() !== 'preview'),
						process: (transform) => this.app.vault.process(file, transform),
					},
					draft.target,
					draft.text,
				).pipe(
					Effect.match({
						onSuccess: (source) => {
							draft.savedTarget = targetFor(source, draft.target.question, draft.target.field)

							return true
						},
						onFailure: (error) => {
							draft.saveError = error.message
							new Notice(`${this.manifest.name}: ${error.message}`)

							return false
						},
					}),
				),
			)
		} catch {
			draft.saveError = 'Saving was interrupted; your draft is kept.'
			new Notice(`${this.manifest.name}: ${draft.saveError}`)
		}

		draft.saving = false
		draft.saved = result

		if (result) {
			draft.editing = false
			draft.wantsFocus = false
		}

		draft.notify()

		return result
	}

	override onunload(): void {
		for (const section of this.sections) section.unload()
		this.sections.clear()

		for (const modal of this.modals) modal.close()
		this.modals.clear()
		void disposePluginRuntime(this.runtime)
		this.runtime = undefined
	}
}
