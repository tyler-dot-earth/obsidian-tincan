import { assert, describe, it } from '@effect/vitest'

import { AnswerError, targetFor, writeAnswer } from '#/src/answer-target'
import { canAnswer, canEdit, questionBlocks } from '#/src/question-blocks'

const question = (kind: string, body: string): string =>
	`> [!question|${kind}] Which route?\n${body}\n`

const options = '> - [ ] River\n> - [ ] Park'

describe('choice Markdown', () => {
	it('offers unanswered choices and editing selected choices without parsing options as questions', () => {
		for (const kind of ['choice', 'choices']) {
			const source = question(kind, options)
			const blocks = questionBlocks(source)
			assert.strictEqual(blocks.length, 1)
			assert.ok(blocks[0] !== undefined && canAnswer(blocks[0]))
			const selected = questionBlocks(source.replace('[ ] River', '[x] River'))
			assert.ok(selected[0] !== undefined && canEdit(selected[0]) && !canAnswer(selected[0]))
		}
	})

	it('leaves malformed, nested, empty, duplicate, or unsupported options without controls', () => {
		for (const body of [
			'',
			'> - River',
			'> - [ ] River\n>   - [ ] Park',
			'> - [ ] River\n> - [ ] River',
			'> Instructions\n' + options,
			'> - [x] River\n> - [x] Park',
			'> - [x] River\n> - [ ] Park\n>\n> Other: A bus ride',
			'> - [ ] River\n> continuation',
		]) {
			assert.ok(!questionBlocks(question('choice', body)).some(canEdit), body)
			assert.throws(() => targetFor(question('choice', body), 'Which route?'), AnswerError)
		}

		assert.ok(!questionBlocks(question('unknown', options)).some(canEdit))
	})

	it('writes single and multiple picks as task markers with title and unrelated text intact', () => {
		for (const kind of ['choice', 'choices']) {
			const source = 'Before\n\n' + question(kind, options) + '\nAfter\n'
			const target = targetFor(source, 'Which route?')
			const answer = kind === 'choice' ? '- [ ] River\n- [x] Park' : '- [x] River\n- [x] Park'

			const expected =
				kind === 'choice'
					? source.replace('[ ] Park', '[x] Park')
					: source.replace('[ ] River', '[x] River').replace('[ ] Park', '[x] Park')

			assert.strictEqual(writeAnswer(source, target, answer), expected)
		}
	})

	it('edits picks while preserving CRLF, indentation, titles, blank lines, and option bytes', () => {
		const source =
			'  > [!question|choices]- Which route?\r\n  >\r\n  > - [X] River > - [ ] untouched\r\n  > - [ ] Park'

		const target = targetFor(source, 'Which route?')
		assert.strictEqual(
			writeAnswer(source, target, '- [ ] River > - [ ] untouched\n- [x] Park'),
			'  > [!question|choices]- Which route?\r\n  >\r\n  > - [ ] River > - [ ] untouched\r\n  > - [x] Park',
		)
	})

	it('rejects multiple radio picks and altered submitted options', () => {
		const source = question('choice', options)
		const target = targetFor(source, 'Which route?')

		for (const answer of [
			'- [x] River\n- [x] Park',
			'- [x] River\n- [ ] Park\n\nOther: A bus ride',
			'- [x] Beach\n- [ ] Park',
			'- [x] River',
			'- [x] Park\n- [ ] River',
		])
			assert.throws(() => writeAnswer(source, target, answer), AnswerError)
	})

	it('rejects changes to picks, options, kind, title, context, or target uniqueness', () => {
		const source = question('choice', options.replace('[ ] River', '[x] River'))
		const target = targetFor(source, 'Which route?')

		for (const changed of [
			source.replace('[x] River', '[ ] River'),
			source.replace('River', 'Beach'),
			source.replace('|choice]', '|choices]'),
			source.replace('choice]', 'choice] Routes'),
			source.replace('Which route?', 'Which route?\n  New context'),
			source + '\n' + source,
		])
			assert.throws(() => writeAnswer(changed, target, '- [ ] River\n- [x] Park'), AnswerError)
		assert.strictEqual(
			writeAnswer('# Added heading\n\n' + source, target, '- [ ] River\n- [x] Park'),
			'# Added heading\n\n' +
				source.replace('[x] River', '[ ] River').replace('[ ] Park', '[x] Park'),
		)
	})
})
