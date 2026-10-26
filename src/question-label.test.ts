// @vitest-environment happy-dom
import { assert, describe, it } from '@effect/vitest'

import { questionLabel, renderedQuestionLabel } from '#/src/question-label'

describe('rendered question identity', () => {
	it('reads the title of a standalone question without its badge, body or note', () => {
		const callout = document.createElement('div')
		callout.dataset['callout'] = 'question'
		callout.innerHTML =
			'<div class="callout-title"><div class="callout-title-inner">Which <strong>route</strong>?</div><span>pick 1</span></div><div class="callout-content">River<div>Ask Friday</div></div>'
		assert.strictEqual(renderedQuestionLabel(callout), questionLabel('Which **route**?'))
	})
	it('reads a loose-list question paragraph without its recommendation or answer', () => {
		const list = document.createElement('ul')
		list.innerHTML =
			'<li><p><input type="checkbox">Which <strong>route</strong>?</p><ul><li>Context</li></ul><div class="callout">Answer</div></li>'
		const callout = list.querySelector<HTMLElement>('.callout')
		assert.ok(callout !== null)
		assert.strictEqual(renderedQuestionLabel(callout), 'Which route?')
		assert.strictEqual(questionLabel('Which **route**?'), 'Which route?')
	})

	it('reads tight-list question text, excluding sublists and the callout', () => {
		const list = document.createElement('ul')
		list.innerHTML =
			'<li><input type="checkbox">When is <a href="day">the day</a>?<ul><li>Today</li></ul><div class="callout">Answer</div></li>'
		const callout = list.querySelector<HTMLElement>('.callout')
		assert.ok(callout !== null)
		assert.strictEqual(renderedQuestionLabel(callout), 'When is the day?')
	})

	it('normalizes ordinary Markdown and wiki-link labels', () => {
		assert.strictEqual(
			questionLabel('Use [[folder/route|this route]] or [another](path)?'),
			'Use this route or another?',
		)
		assert.strictEqual(questionLabel('Use `code`\n  tomorrow?'), 'Use code tomorrow?')
		assert.strictEqual(questionLabel('Read [[folder/Guide]]?'), 'Read Guide?')
	})

	it('does not let a correct-looking descendant stand in for another question', () => {
		const list = document.createElement('ul')
		list.innerHTML =
			'<li>Different question<ul><li>Expected question</li></ul><div class="callout"></div></li>'
		const callout = list.querySelector<HTMLElement>('.callout')
		assert.ok(callout !== null)
		assert.notStrictEqual(renderedQuestionLabel(callout), questionLabel('Expected question'))
	})
})
