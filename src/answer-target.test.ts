import { assert, describe, it } from '@effect/vitest'

import { AnswerError, matchTarget, targetFor, writeAnswer } from '#/src/answer-target'

const note =
	'- [ ] Where?\n  > [!answer]\n\n- [ ] When?\n  - context: Any day.\n\n  > [!answer]\n  >\n\nFooter\n'

const target = targetFor(note, 'When?')

describe('writeAnswer', () => {
	it('answers the second question after lines shift and preserves unrelated bytes', () => {
		assert.strictEqual(
			writeAnswer(`# New heading\n\n${note}`, target, 'Tomorrow'),
			`# New heading\n\n- [ ] Where?\n  > [!answer]\n\n- [ ] When?\n  - context: Any day.\n\n  > [!answer]\n  > Tomorrow\n\nFooter\n`,
		)
	})

	it('keeps multiline Markdown inside a callout with CRLF and tab indentation', () => {
		const source = '# Plan\r\n\r\n- [ ] When?\r\n\t> [!answer] Custom title\r\n\t>\r\n\r\nTail\r\n'
		assert.strictEqual(
			writeAnswer(source, targetFor(source, 'When?'), 'Tomorrow\n\n- Morning\n- Evening'),
			'# Plan\r\n\r\n- [ ] When?\r\n\t> [!answer] Custom title\r\n\t> Tomorrow\r\n\t> \r\n\t> - Morning\r\n\t> - Evening\r\n\r\nTail\r\n',
		)
	})

	it('preserves a missing final newline and the question checkbox', () => {
		assert.strictEqual(
			writeAnswer(
				'- [ ] When?\n  > [!answer]',
				targetFor('- [ ] When?\n  > [!answer]', 'When?'),
				'Now',
			),
			'- [ ] When?\n  > [!answer]\n  > Now',
		)
	})

	it('refuses duplicate question text even with different context or a matching old line', () => {
		assert.throws(
			() =>
				writeAnswer(
					`${note}\n- [ ] When?\n  - context: Different.\n\n  > [!answer]\n`,
					target,
					'Tomorrow',
				),
			AnswerError,
		)
		assert.throws(
			() =>
				writeAnswer(`${note}\n- [x] When?\n  > [!answer]\n  > Already done\n`, target, 'Tomorrow'),
			AnswerError,
		)
	})

	it('refuses changed, deleted, filled, completed, or ambiguous targets', () => {
		const invalid = [
			note.replace('When?', 'What time?'),
			note.replace('Any day.', 'Weekdays.'),
			'',
			note.replace('  >\n\nFooter', '  > Yesterday\n\nFooter'),
			note.replace('- [ ] When?', '- [x] When?'),
			note.replace('  >\n\nFooter', '  >\n\n  > [!answer]\n\nFooter'),
		]

		for (const source of invalid)
			assert.throws(() => writeAnswer(source, target, 'Tomorrow'), AnswerError)
	})

	it('refuses blank submissions and ignores duplicate examples', () => {
		assert.throws(() => writeAnswer(note, target, ' \n\t'), AnswerError)
		assert.strictEqual(
			matchTarget(`\`\`\`md\n- [ ] When?\n  > [!answer]\n\`\`\`\n\n${note}`, target).question,
			'When?',
		)
	})
})
