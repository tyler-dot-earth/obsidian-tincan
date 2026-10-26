import { assert, describe, it } from '@effect/vitest'
import { Effect } from 'effect'

import { answerContent, isAnswered } from '#/src/answer-content'
import { AnswerError, targetFor, writeAnswer } from '#/src/answer-target'
import { canAnnotate, questionBlocks } from '#/src/question-blocks'
import { saveAnswer } from '#/src/save-answer'

const pick = '> [!question|choice] Walk?\n> - [ ] 🤖 A short walk\n> - [ ] Stay home\n'

describe('Other and side-note Markdown', () => {
	it('counts free text or a recommended pick as answered, independently of side notes', () => {
		const content = answerContent(
			'choice',
			'- [ ] 🤖 A short walk\n- [ ] Stay home\n\nOther: A picnic in the park',
		)

		assert.ok(content !== undefined && isAnswered(content))
		const checked = answerContent('choice', '- [x] 🤖 A short walk\n- [ ] Stay home')
		assert.ok(checked !== undefined && isAnswered(checked))
		const block = questionBlocks(pick + '>\n> > [!note]\n> > Leaning toward a walk.\n')[0]
		assert.strictEqual(block?.slots[0]?.blank, true)
		assert.strictEqual(block?.notes[0]?.blank, false)
	})

	it('adds, edits and clears multi-pick Other without changing picks or unrelated note bytes', () => {
		const source =
			'# Plan\r\n\r\n' +
			pick.replace('|choice]', '|choices]').replace(/\n/g, '\r\n').replace('[ ] 🤖', '[X] 🤖') +
			'\r\nTail\r\n'

		const opened = targetFor(source, 'Walk?')

		const saved = writeAnswer(
			source,
			opened,
			'- [x] 🤖 A short walk\n- [ ] Stay home\n\nOther: Bring a friend\n\n- Ask about timing',
		)

		assert.strictEqual(
			saved,
			source.replace(
				'> - [ ] Stay home\r\n',
				'> - [ ] Stay home\r\n>\r\n> Other: Bring a friend\r\n> \r\n> - Ask about timing\r\n',
			),
		)

		const edited = writeAnswer(
			saved,
			targetFor(saved, 'Walk?'),
			'- [x] 🤖 A short walk\n- [ ] Stay home\n\nOther: Go later',
		)

		assert.match(edited, /Other: Go later\r\n\r\nTail/)

		const cleared = writeAnswer(
			edited,
			targetFor(edited, 'Walk?'),
			'- [x] 🤖 A short walk\n- [ ] Stay home',
		)

		assert.ok(!cleared.includes('Other:'))
		assert.match(cleared, /\[X\] 🤖 A short walk/)
	})

	it('preserves Other prose, nested checklists, CRLF and missing final newline during a pick', () => {
		const source =
			pick.replace('|choice]', '|choices]').replace(/\n/g, '\r\n') +
			'>\r\n> Other: A picnic in the park\r\n> - [ ] Leave this text alone'

		assert.strictEqual(
			writeAnswer(
				source,
				targetFor(source, 'Walk?'),
				'- [x] 🤖 A short walk\n- [ ] Stay home\n\nOther: A picnic in the park\n- [ ] Leave this text alone',
			),
			source.replace('[ ] 🤖', '[x] 🤖'),
		)
	})

	it('keeps a missing final newline when clearing an Other-only answer', () => {
		const source = pick + '>\n> Other: Later'

		const cleared = writeAnswer(
			source,
			targetFor(source, 'Walk?'),
			'- [ ] 🤖 A short walk\n- [ ] Stay home',
		)

		assert.strictEqual(cleared, pick + '>')
	})

	it('refuses changed Other', () => {
		const source = pick + '>\n> Other: Later\n'
		assert.throws(
			() =>
				writeAnswer(
					source.replace('Other: Later', 'Other: Now'),
					targetFor(source, 'Walk?'),
					'- [ ] 🤖 A short walk\n- [ ] Stay home\n\nOther: Later',
				),
			AnswerError,
		)
	})

	it.each(['', '>\n'])('refuses implicit note fields with body %s', (body) => {
		const source = '> [!question] Revisit this?\n' + body
		const block = questionBlocks(source)[0]
		assert.ok(block !== undefined)
		assert.strictEqual(canAnnotate(block), false)
		assert.throws(() => targetFor(source, 'Revisit this?', 'note'), AnswerError)
	})

	it.effect(
		'validates side-note source and original-file guards inside the same Effect write program',
		() =>
			Effect.gen(function* () {
				let source = '> [!question] Revisit?\n>\n> > [!note]\n> >\n'
				let writes = 0
				let available = true

				const writer = {
					available: () => available,
					editing: () => false,
					process: (transform: (text: string) => string) =>
						new Promise<string>((resolve) => {
							source = transform(source)
							writes += 1
							resolve(source)
						}),
				}

				const opened = targetFor(source, 'Revisit?', 'note')
				available = false
				yield* Effect.flip(saveAnswer(writer, opened, 'Keep this draft'))
				assert.strictEqual(writes, 0)
				available = true
				yield* saveAnswer(writer, opened, 'Ask after Friday')
				assert.strictEqual(writes, 1)
				assert.match(source, /\[!note\]\n> > Ask after Friday/)
				yield* Effect.flip(saveAnswer(writer, opened, 'Stale insertion'))
				assert.strictEqual(writes, 1)
			}),
	)
})
