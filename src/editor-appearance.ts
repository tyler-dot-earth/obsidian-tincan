import { NativeQuestion } from '#/src/native-question'
import type { OtherActions } from '#/src/other-control'
import { canEdit, questionBlocks, type QuestionBlock } from '#/src/question-blocks'
import { questionLabel, renderedQuestionLabel } from '#/src/question-label'
import { answerCallouts } from '#/src/reading-callouts'

interface DecoratedQuestion {
	readonly key: string
	readonly control: NativeQuestion
}

/** Observe disposable live-preview widgets; their DOM and Markdown stay owned by Obsidian. */
export class EditorAppearance {
	private readonly decorated = new Map<HTMLElement, DecoratedQuestion>()
	private readonly observer: MutationObserver
	private readonly window: Window
	private readonly container: HTMLElement
	private readonly source: () => string | undefined
	private readonly renderIcon: OtherActions['renderIcon']
	private readonly blocks = new Map<string, QuestionBlock | undefined>()
	private snapshot: string | undefined
	private frame: number | undefined
	private active = true

	constructor(
		container: HTMLElement,
		source: () => string | undefined,
		renderIcon: OtherActions['renderIcon'],
	) {
		this.container = container
		this.source = source
		this.renderIcon = renderIcon
		const window = container.ownerDocument.defaultView

		if (window === null) throw new Error('The editor window is unavailable.')
		this.window = window
		this.observer = new window.MutationObserver(() => this.schedule())
		this.observe()
		this.schedule()
	}

	schedule(): void {
		if (!this.active || this.frame !== undefined) return
		this.frame = this.window.requestAnimationFrame(() => {
			this.frame = undefined
			this.refresh()
		})
	}

	private observe(): void {
		this.observer.observe(this.container, { childList: true, subtree: true })
	}

	private refresh(): void {
		this.observer.disconnect()
		const source = this.source()
		const root = this.container.querySelector<HTMLElement>('.markdown-source-view')
		const callouts = source === undefined || root === null ? [] : answerCallouts(root)
		this.readSource(source)
		const live = new Set(callouts)

		for (const [element, decorated] of this.decorated) {
			if (live.has(element)) continue
			decorated.control.unload()
			this.decorated.delete(element)
		}

		for (const element of callouts) this.decorate(element)

		this.observe()
	}

	private readSource(source: string | undefined): void {
		if (source === this.snapshot) return
		this.snapshot = source
		this.blocks.clear()

		if (source === undefined) return

		for (const block of questionBlocks(source)) {
			const label = questionLabel(block.question)
			this.blocks.set(label, this.blocks.has(label) ? undefined : block)
		}
	}

	private forget(element: HTMLElement): void {
		this.decorated.get(element)?.control.unload()
		this.decorated.delete(element)
	}

	private decorate(element: HTMLElement): void {
		const block = this.blocks.get(renderedQuestionLabel(element))

		if (block === undefined || !canEdit(block)) {
			this.forget(element)

			return
		}

		const current = this.decorated.get(element)

		const key = JSON.stringify([
			block.context,
			block.slots[0].source,
			...block.notes.map((note) => note.source),
		])

		if (current !== undefined && current.key === key && current.control.intact()) return
		this.forget(element)
		this.decorated.set(element, {
			key,
			control: new NativeQuestion(element, block, this.renderIcon),
		})
	}

	unload(): void {
		this.active = false
		this.observer.disconnect()

		if (this.frame !== undefined) this.window.cancelAnimationFrame(this.frame)

		for (const decorated of this.decorated.values()) decorated.control.unload()
		this.decorated.clear()
	}
}
