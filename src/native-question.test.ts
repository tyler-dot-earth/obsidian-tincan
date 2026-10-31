// @vitest-environment happy-dom
import { assert, it } from '@effect/vitest'

import { EditorAppearance } from '#/src/editor-appearance'
import { NativeQuestion } from '#/src/native-question'
import { questionBlocks } from '#/src/question-blocks'

const source =
	'> [!question|choice] Route?\n> - [ ] River\n>   > [!note]\n>   > Quieter.\n> - [ ] Park\n>\n> Other: Past the market.\n'

const html =
	'<div class="callout" data-callout="question"><div class="callout-title"><div class="callout-icon"><svg data-original="true"></svg></div><div class="callout-title-inner">Route?</div></div><div class="callout-content"><ul class="contains-task-list"><li class="task-list-item" data-task=""><input class="task-list-item-checkbox" type="checkbox" data-line="1">River<div class="callout" data-callout="note"><div class="callout-title">Note</div><div class="callout-content"><p>Quieter.</p></div></div></li><li class="task-list-item" data-task=""><input class="task-list-item-checkbox" type="checkbox" data-line="4">Park</li></ul><p>Other: Past the market.</p></div></div>'

const makeBox = (): HTMLElement => {
	const container = document.createElement('div')
	container.innerHTML = html
	const box = container.firstElementChild
	assert.ok(box instanceof HTMLElement)

	return box
}

const renderIcon = (element: HTMLElement, icon: string): void => {
	element.textContent = icon
}

const frame = (): Promise<number> => new Promise((resolve) => requestAnimationFrame(resolve))

it('uses saved answer state for native colors, status and icon, including a custom answer', () => {
	const box = makeBox()
	const block = questionBlocks(source)[0]
	assert.ok(block !== undefined)
	const control = new NativeQuestion(box, block, renderIcon)
	assert.ok(box.classList.contains('answer-answered'))
	assert.strictEqual(box.querySelector('.callout-icon')?.textContent, 'circle-check')
	assert.strictEqual(box.querySelector('.answer-kind')?.textContent, 'pick 1')
	assert.strictEqual(box.querySelector('.answer-other-value')?.textContent, 'Past the market.')
	assert.ok(box.querySelector('.answer-option-note') !== null)
	assert.strictEqual(box.querySelectorAll('button, textarea').length, 0)
	control.unload()
})

it('preserves native checkbox identity, data-line and event handlers, and restores the original DOM', () => {
	const box = makeBox()
	const original = box.outerHTML
	document.body.append(box)
	const input = box.querySelector('input')
	assert.ok(input !== null)
	let changes = 0
	input.addEventListener('change', () => {
		changes += 1
	})
	const block = questionBlocks(source)[0]
	assert.ok(block !== undefined)
	const control = new NativeQuestion(box, block, renderIcon)
	assert.strictEqual(box.querySelector('input'), input)
	assert.strictEqual(input.dataset['line'], '1')
	input.click()
	assert.strictEqual(changes, 1)
	assert.strictEqual(input.checked, true)
	control.unload()
	assert.strictEqual(box.outerHTML, original)
	assert.strictEqual(box.querySelector('input'), input)
	box.remove()
})

it('decorates new editor widgets and follows unsaved Markdown changes', async () => {
	const container = document.createElement('div')
	container.innerHTML = '<div class="markdown-source-view"></div>'
	document.body.append(container)
	let current = source
	const appearance = new EditorAppearance(container, () => current, renderIcon)
	await frame()
	const box = makeBox()
	container.firstElementChild?.append(box)
	await frame()
	await frame()
	assert.ok(box.classList.contains('answer-answered'))
	current = source.replace('>\n> Other: Past the market.\n', '')
	appearance.schedule()
	await frame()
	assert.ok(box.classList.contains('answer-unanswered'))
	assert.strictEqual(box.querySelector<HTMLElement>('.answer-status')?.hidden, true)
	appearance.unload()
	assert.ok(!box.classList.contains('answer-question'))
	assert.strictEqual(box.querySelector('.answer-kind'), null)
	container.remove()
})

it('leaves ambiguous questions, embeds and inactive editors native', async () => {
	const container = document.createElement('div')
	container.innerHTML = '<div class="markdown-source-view"></div>'
	const box = makeBox()
	container.firstElementChild?.append(box)
	let current: string | undefined = source + '\n' + source
	const appearance = new EditorAppearance(container, () => current, renderIcon)
	await frame()
	assert.ok(!box.classList.contains('answer-question'))
	current = source
	const embed = document.createElement('div')
	embed.className = 'markdown-embed'
	box.replaceWith(embed)
	embed.append(box)
	await frame()
	await frame()
	assert.ok(!box.classList.contains('answer-question'))
	embed.replaceWith(box)
	current = undefined
	appearance.schedule()
	await frame()
	assert.ok(!box.classList.contains('answer-question'))
	appearance.unload()
})

it('groups multiline custom text once and restores the native paragraphs on unload', () => {
	const box = makeBox()
	const paragraph = box.querySelector('.callout-content > p')
	assert.ok(paragraph !== null)
	const continuation = document.createElement('p')
	continuation.textContent = 'Stop for coffee.'
	paragraph.after(continuation)
	const original = box.outerHTML

	const block = questionBlocks(
		source.replace('Other: Past the market.', 'Other: Past the market.\n>\n> Stop for coffee.'),
	)[0]

	assert.ok(block !== undefined)
	const control = new NativeQuestion(box, block, renderIcon)
	assert.strictEqual(
		box.querySelector('.answer-other-value')?.textContent,
		'Past the market.\n\nStop for coffee.',
	)
	assert.strictEqual(box.querySelectorAll('.callout-content > p').length, 2)
	assert.strictEqual(continuation.isConnected, false)
	control.unload()
	assert.strictEqual(box.outerHTML, original)
})

it('reapplies appearance when Obsidian replaces a widget body without changing its source', async () => {
	const container = document.createElement('div')
	container.innerHTML = '<div class="markdown-source-view"></div>'
	const box = makeBox()
	container.firstElementChild?.append(box)
	const appearance = new EditorAppearance(container, () => source, renderIcon)
	await frame()
	assert.ok(box.querySelector('.answer-other-callout') !== null)
	box.innerHTML = makeBox().innerHTML
	await frame()
	await frame()
	assert.ok(box.querySelector('.answer-other-callout') !== null)
	assert.strictEqual(box.querySelectorAll('.answer-kind').length, 1)
	appearance.unload()
	assert.strictEqual(box.outerHTML, makeBox().outerHTML)
})
