// @vitest-environment happy-dom
import { assert, describe, it } from '@effect/vitest'

import { applyAppearance } from '#/src/answer-appearance'
import { questionBlocks } from '#/src/question-blocks'

describe('answer appearance', () => {
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
