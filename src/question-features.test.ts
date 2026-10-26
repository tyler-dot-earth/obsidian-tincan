import { assert, describe, it } from '@effect/vitest'
import { Effect } from 'effect'

import { answerContent, isAnswered } from '#/src/answer-content'
import { AnswerError, targetFor, writeAnswer } from '#/src/answer-target'
import { canAnnotate, questionBlocks } from '#/src/question-blocks'
import { saveAnswer } from '#/src/save-answer'

const pick = '- [ ] Walk?\n  > [!answer|choice]\n  > - [ ] 🤖 A short walk\n  > - [ ] Stay home\n'

describe('Other and side-note Markdown', () => {
	it('counts free text or a recommended pick as answered, independently of side notes', () => {
		const content = answerContent(
			'choice',
			'- [ ] 🤖 A short walk\n- [ ] Stay home\n\nOther: A picnic in the park',
		)

		assert.ok(content !== undefined && isAnswered(content))
		const checked = answerContent('choice', '- [x] 🤖 A short walk\n- [ ] Stay home')
		assert.ok(checked !== undefined && isAnswered(checked))
		const block = questionBlocks(pick + '  >\n  > > [!note]\n  > > Leaning toward a walk.\n')[0]
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
				'  > - [ ] Stay home\r\n',
				'  > - [ ] Stay home\r\n  >\r\n  > Other: Bring a friend\r\n  > \r\n  > - Ask about timing\r\n',
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
			'  >\r\n  > Other: A picnic in the park\r\n  > - [ ] Leave this text alone'

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
		const source = pick + '  >\n  > Other: Later'

		const cleared = writeAnswer(
			source,
			targetFor(source, 'Walk?'),
			'- [ ] 🤖 A short walk\n- [ ] Stay home',
		)

		assert.strictEqual(cleared, pick + '  >')
	})

	it('refuses changed Other', () => {
		const source = pick + '  >\n  > Other: Later\n'
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

	it.each(['- [ ]', '- [x]'])(
		'inserts and edits a side note on %s questions without an answer slot',
		(task) => {
			const source = `Heading\n\n${task} Revisit this?\n\nTail\n`
			const opened = targetFor(source, 'Revisit this?', 'note')
			const saved = writeAnswer(source, opened, 'Leaning A, but ask after Friday.')
			assert.strictEqual(
				saved,
				`Heading\n\n${task} Revisit this?\n\n  > [!answer]\n  >\n  > > [!note]\n  > > Leaning A, but ask after Friday.\n\nTail\n`,
			)

			const edited = writeAnswer(saved, targetFor(saved, 'Revisit this?', 'note'), 'Ask next week.')

			assert.strictEqual(
				edited,
				saved.replace('Leaning A, but ask after Friday.', 'Ask next week.'),
			)
			const block = questionBlocks(edited)[0]
			assert.ok(block !== undefined && canAnnotate(block))
			assert.strictEqual(block.slots.length, 1)
		},
	)

	it('inserts a parent side note after a nested task and preserves CRLF, tabs and EOF', () => {
		const source = '- [ ] Parent?\r\n\t- [ ] Child?'
		const saved = writeAnswer(source, targetFor(source, 'Parent?', 'note'), 'Parent comment')
		assert.strictEqual(
			saved,
			source + '\r\n\r\n  > [!answer]\r\n  >\r\n  > > [!note]\r\n  > > Parent comment',
		)
		assert.strictEqual(targetFor(saved, 'Parent?', 'note').answer?.content?.kind, 'text')
		assert.strictEqual(
			questionBlocks(saved).find((block) => block.question === 'Child?')?.notes.length,
			0,
		)
	})

	it.effect(
		'validates side-note source and original-file guards inside the same Effect write program',
		() =>
			Effect.gen(function* () {
				let source = '- [ ] Revisit?\n'
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
				assert.match(source, /\[!note\]\n  > > Ask after Friday/)
				yield* Effect.flip(saveAnswer(writer, opened, 'Stale insertion'))
				assert.strictEqual(writes, 1)
			}),
	)
})
