// @vitest-environment happy-dom
import { assert, describe, it } from '@effect/vitest'

import { answerCallouts } from '#/src/reading-callouts'

describe('supported reading surface', () => {
	it('counts only standalone question callouts in rendered order', () => {
		const root = document.createElement('div')
		root.innerHTML =
			'<div class="callout" data-callout="question" id="first"><div class="callout" data-callout="note"></div></div><div class="callout" data-callout="note"></div><div class="callout" data-callout="question" id="second"></div>'
		assert.deepStrictEqual(
			answerCallouts(root).map((box) => box.id),
			['first', 'second'],
		)
	})

	it('excludes list-contained, embedded, quoted, nested and popover examples', () => {
		const element = document.createElement('div')

		for (const container of [
			'<ul><li>CONTENT</li></ul>',
			'<div class="markdown-embed">CONTENT</div>',
			'<div class="internal-embed">CONTENT</div>',
			'<blockquote>CONTENT</blockquote>',
			'<div class="callout">CONTENT</div>',
			'<div class="hover-popover">CONTENT</div>',
		]) {
			element.innerHTML = container.replace(
				'CONTENT',
				'<div class="callout" data-callout="question"></div>',
			)

			assert.deepStrictEqual(answerCallouts(element), [], container)
		}
	})

	it('includes a question callout that is itself the postprocessor root', () => {
		const element = document.createElement('div')
		element.className = 'callout'
		element.dataset['callout'] = 'question'
		assert.deepStrictEqual(answerCallouts(element), [element])
	})
})
