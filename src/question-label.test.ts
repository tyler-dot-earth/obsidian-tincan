// @vitest-environment happy-dom
import { assert, describe, it } from '@effect/vitest'

import { questionLabel, renderedQuestionLabel } from '#/src/question-label'

describe('rendered question identity', () => {
	it('reads the title without its badge, body or note', () => {
		const callout = document.createElement('div')
		callout.innerHTML =
			'<div class="callout-title"><div class="callout-title-inner">Which <strong>route</strong>?</div><span>pick 1</span></div><div class="callout-content">River<div>Ask Friday</div></div>'
		assert.strictEqual(renderedQuestionLabel(callout), questionLabel('Which **route**?'))
	})

	it('normalizes ordinary Markdown and wiki-link labels', () => {
		assert.strictEqual(
			questionLabel('Use [[folder/route|this route]] or [another](path)?'),
			'Use this route or another?',
		)
		assert.strictEqual(questionLabel('Use `code`\n  tomorrow?'), 'Use code tomorrow?')
		assert.strictEqual(questionLabel('Read [[folder/Guide]]?'), 'Read Guide?')
	})

	it('does not let a descendant title stand in for a missing question title', () => {
		const callout = document.createElement('div')
		callout.innerHTML =
			'<div class="callout-content"><div class="callout"><div class="callout-title"><div class="callout-title-inner">Expected question</div></div></div></div>'
		assert.strictEqual(renderedQuestionLabel(callout), '')
	})
})
