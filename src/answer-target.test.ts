import { assert, describe, it } from '@effect/vitest'

import { AnswerError, matchTarget, targetFor, writeAnswer } from '#/src/answer-target'

const note = '> [!question] Where?\n\nAny day.\n\n> [!question] When?\n>\n\nFooter\n'

const target = targetFor(note, 'When?')

describe('writeAnswer', () => {
	it('answers the second question after lines shift and preserves unrelated bytes', () => {
		assert.strictEqual(
			writeAnswer('# New heading\n\n' + note, target, 'Tomorrow'),
			'# New heading\n\n' + note.replace('When?\n>\n', 'When?\n> Tomorrow\n'),
		)
	})

	it('keeps multiline Markdown inside an indented callout with CRLF', () => {
		const source = '# Plan\r\n\r\n  > [!question]- When?\r\n  >\r\n\r\nTail\r\n'
		assert.strictEqual(
			writeAnswer(source, targetFor(source, 'When?'), 'Tomorrow\n\n- Morning\n- Evening'),
			'# Plan\r\n\r\n  > [!question]- When?\r\n  > Tomorrow\r\n  > \r\n  > - Morning\r\n  > - Evening\r\n\r\nTail\r\n',
		)
	})

	it('preserves the question title and missing final newline', () => {
		const source = '> [!question] When?'
		assert.strictEqual(
			writeAnswer(source, targetFor(source, 'When?'), 'Now'),
			'> [!question] When?\n> Now',
		)
	})

	it('refuses duplicate question titles even with different bodies or a matching old line', () => {
		for (const body of ['> Different context\n', '> Already answered\n'])
			assert.throws(
				() => writeAnswer(note + '\n> [!question] When?\n' + body, target, 'Tomorrow'),
				AnswerError,
			)
	})

	it('refuses changed titles, headers, deleted questions, concurrent answers and merged callouts', () => {
		for (const source of [
			note.replace('When?', 'What time?'),
			note.replace('[!question] When?', '[!question]+ When?'),
			'',
			note.replace('>\n\nFooter', '> Yesterday\n\nFooter'),
			note.replace('>\n\nFooter', '>\n> [!question] Extra?\n\nFooter'),
		])
			assert.throws(() => writeAnswer(source, target, 'Tomorrow'), AnswerError)
	})

	it('refuses blank submissions and ignores duplicate fenced examples', () => {
		assert.throws(() => writeAnswer(note, target, ' \n\t'), AnswerError)
		assert.strictEqual(
			matchTarget('```md\n> [!question] When?\n```\n\n' + note, target).question,
			'When?',
		)
	})
})
