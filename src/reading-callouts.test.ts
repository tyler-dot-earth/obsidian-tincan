// @vitest-environment happy-dom
import { assert, describe, it } from '@effect/vitest'

import { answerCallouts } from '#/src/reading-callouts'

describe('supported reading surface', () => {
	it('excludes embedded, quoted, and nested callouts from source-order counting', () => {
		const element = document.createElement('div')
		element.innerHTML =
			'<ul><li>First<div class="callout" data-callout="answer" id="first"><div class="callout" data-callout="answer" id="nested"></div></div></li><li>Second<div class="callout" data-callout="answer" id="second"></div></li></ul><div class="markdown-embed"><div class="callout" data-callout="answer"></div></div><blockquote><div class="callout" data-callout="answer"></div></blockquote><div class="callout" data-callout="note"><div class="callout" data-callout="answer"></div></div>'
		assert.deepStrictEqual(
			answerCallouts(element).map((callout) => callout.id),
			['first', 'second'],
		)
	})

	it('includes an answer callout that is itself the postprocessor root', () => {
		const element = document.createElement('div')
		element.className = 'callout'
		element.dataset['callout'] = 'answer'
		assert.deepStrictEqual(answerCallouts(element), [element])
	})
})
