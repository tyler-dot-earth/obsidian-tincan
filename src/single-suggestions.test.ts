import { assert, describe, it } from '@effect/vitest'
import { Effect } from 'effect'

import { answerContent, isAnswered } from '#/src/answer-content'
import { targetFor } from '#/src/answer-target'
import { Draft } from '#/src/drafts'
import { canAnswer, questionBlocks } from '#/src/question-blocks'
import { saveAnswer } from '#/src/save-answer'

const suggested = '> [!question|choice] When?\n> - [ ] 🤖 After lunch\n'

describe('single-option suggestions', () => {
	it('keeps the suggestion unchecked and the draft ready to pick, independently of recommendation text in notes', () => {
		const source =
			'> [!question|choice] When?\n>\n> - [ ] 🤖 After lunch\n>\n> > [!note]\n> > 🤖 Ask again Friday\n'

		const block = questionBlocks(source)[0]
		assert.ok(block !== undefined && canAnswer(block))
		assert.strictEqual(block.slots[0]?.blank, true)
		assert.strictEqual(block.notes[0]?.blank, false)
		assert.deepStrictEqual(block.notes[0]?.content, {
			kind: 'text',
			text: '🤖 Ask again Friday',
		})
		const target = targetFor(source, 'When?')
		assert.deepStrictEqual(target.answer?.content, {
			kind: 'choice',
			options: [{ label: '🤖 After lunch', checked: false }],
			other: '',
		})
		assert.strictEqual(new Draft(target).text, '- [ ] 🤖 After lunch')
	})

	it.each([
		'🤖 After lunch',
		'🤖',
		'After lunch with 🤖',
		'🤖 After lunch\nActually, before dinner.',
		'- 🤖 After lunch',
		'```\n🤖 After lunch\n```',
	])('keeps ordinary answer text literal: %s', (text) => {
		const content = answerContent('text', text)
		assert.deepStrictEqual(content, { kind: 'text', text })
		assert.ok(content !== undefined && isAnswered(content))
	})

	it.effect('checks the suggestion once while preserving CRLF and a concurrently edited note', () =>
		Effect.gen(function* () {
			const source =
				'Heading\r\n\r\n> [!question|choice] When?\r\n> - [ ] 🤖 After lunch\r\n>\r\n> > [!note]\r\n> > Ask Friday\r\n\r\nTail'

			const target = targetFor(source, 'When?')
			assert.deepStrictEqual(target.answer?.content, {
				kind: 'choice',
				options: [{ label: '🤖 After lunch', checked: false }],
				other: '',
			})
			let current = source.replace('Ask Friday', 'Ask Monday')
			let writes = 0

			const saved = yield* saveAnswer(
				{
					available: () => true,
					editing: () => false,
					process: (transform) =>
						new Promise<string>((resolve) => {
							current = transform(current)
							writes += 1
							resolve(current)
						}),
				},
				target,
				'- [x] 🤖 After lunch',
			)

			assert.strictEqual(writes, 1)
			assert.strictEqual(
				saved,
				source.replace('[ ] 🤖', '[x] 🤖').replace('Ask Friday', 'Ask Monday'),
			)
			assert.strictEqual(targetFor(saved, 'When?').answer?.blank, false)
		}),
	)

	it.effect(
		'refuses changed suggestions, new answers, and duplicate questions inside Vault.process',
		() =>
			Effect.gen(function* () {
				for (const current of [
					suggested.replace('After lunch', 'Before dinner'),
					suggested.replace('[ ] 🤖', '[x] 🤖'),
					suggested + '\n' + suggested,
				]) {
					const draft = new Draft(targetFor(suggested, 'When?'))
					draft.text = '- [ ] 🤖 After lunch\n\nOther: My own answer'
					let writes = 0

					const failure = yield* Effect.flip(
						saveAnswer(
							{
								available: () => true,
								editing: () => false,
								process: (transform) =>
									new Promise<string>((resolve) => {
										const saved = transform(current)
										writes += 1
										resolve(saved)
									}),
							},
							draft.target,
							draft.text,
						),
					)

					assert.match(failure.message, /changed|duplicated/)
					assert.strictEqual(writes, 0)
					assert.strictEqual(draft.text, '- [ ] 🤖 After lunch\n\nOther: My own answer')
				}
			}),
	)
})
