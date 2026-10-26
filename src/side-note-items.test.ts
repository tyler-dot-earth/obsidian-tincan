// @vitest-environment happy-dom
import { assert, describe, it } from '@effect/vitest'

import { applyAppearance } from '#/src/answer-appearance'
import { questionBlocks } from '#/src/question-blocks'
import { questionCallout, sideNoteItems } from '#/src/side-note-items'

const section = {
	text: '- [ ] Pick?\n  > [!answer]\n\n- [x] Revisit?\n',
	lineStart: 0,
	lineEnd: 20,
}

describe('side-note association and appearance', () => {
	it('matches task labels and source order including completed questions', () => {
		const root = document.createElement('div')
		root.innerHTML =
			'<ul><li class="task-list-item">Pick?<div class="callout" data-callout="answer"></div></li><li class="task-list-item">Revisit?</li></ul>'
		const items = sideNoteItems(root, section)
		assert.deepStrictEqual(
			items.map((item) => item.block.question),
			['Pick?', 'Revisit?'],
		)
		assert.strictEqual(items[1]?.block.completed, true)
		const first = items[0]
		assert.ok(first !== undefined)
		const callout = questionCallout(first.element)
		assert.strictEqual(callout.dataset['callout'], 'answer')
		assert.strictEqual(callout.parentElement, first.element)
	})

	it('refuses mismatched counts and labels and ignores tasks inside quotes and embeds', () => {
		const root = document.createElement('div')
		root.innerHTML =
			'<ul><li class="task-list-item">Other?</li></ul><div class="callout"><li class="task-list-item">Pick?</li></div><div class="internal-embed"><li class="task-list-item">Revisit?</li></div>'
		assert.deepStrictEqual(sideNoteItems(root, section), [])
		root.innerHTML =
			'<li class="task-list-item">Other?</li><li class="task-list-item">Revisit?</li>'
		assert.deepStrictEqual(
			sideNoteItems(root, section).map((item) => item.block.question),
			['Revisit?'],
		)
	})

	it('assigns distinct classes from saved content, including Other-only and completed answers', () => {
		const cases = [
			['- [ ] Q?\n  > [!answer]\n', 'answer-unanswered'],
			['- [x] Q?\n  > [!answer]\n  > Existing\n', 'answer-answered'],
			['- [ ] Q?\n  > [!answer|choice]\n  > - [ ] 🤖 A\n  >\n  > Other: B\n', 'answer-answered'],
		]

		for (const [source, expected] of cases) {
			assert.ok(source !== undefined && expected !== undefined)
			const element = document.createElement('div')
			applyAppearance(element, 'answer', questionBlocks(source)[0]?.slots[0]?.content)
			assert.strictEqual(element.className, expected)
			applyAppearance(element, 'note', undefined)
			assert.strictEqual(element.className, 'answer-side-note')
		}
	})
})
