import { assert, describe, it } from '@effect/vitest'
import { Effect } from 'effect'

import { AnswerError, targetFor, writeAnswer } from '#/src/answer-target'
import { canAnnotate, canEdit, questionBlocks } from '#/src/question-blocks'
import { saveAnswer } from '#/src/save-answer'
import { sectionTargets } from '#/src/section-targets'

const choices = '> - [ ] River\n> - [ ] Park\n'

const note = '>\n> > [!note]\n> > Ask Friday\n'

describe('question in a callout', () => {
	it.each([
		['', '> Tomorrow\n', 'Friday', '> Friday\n'],
		['|choice', choices, '- [x] River\n- [ ] Park', choices.replace('[ ] River', '[x] River')],
		['|choices', choices, '- [x] River\n- [x] Park', choices.replaceAll('[ ]', '[x]')],
	])(
		'writes %s answers without changing the question title or note',
		(kind, body, answer, saved) => {
			const header = '> [!question' + kind + '] Where?\n'
			const source = 'Before\n\n' + header + body + note + '\nAfter\n'
			const blocks = questionBlocks(source)
			assert.strictEqual(blocks.length, 1)
			assert.ok(blocks[0] !== undefined && canEdit(blocks[0]) && canAnnotate(blocks[0]))
			assert.strictEqual(
				writeAnswer(source, targetFor(source, 'Where?'), answer),
				'Before\n\n' + header + saved + note + '\nAfter\n',
			)
		},
	)

	it('keeps legacy and title questions in source order and validates duplicates across both', () => {
		const legacy = '- [x] Legacy?\n  > [!answer] Custom title\n  > Answer\n'
		const source = legacy + '\n> [!question] Modern?\n>\n'
		assert.deepStrictEqual(
			sectionTargets({ text: source, lineStart: 0, lineEnd: 20 }, 2).map((block) => block.question),
			['Legacy?', 'Modern?'],
		)
		assert.strictEqual(questionBlocks(source)[0]?.completed, true)
		assert.throws(() => targetFor(source.replace('Modern?', 'Legacy?'), 'Legacy?'), /duplicated/)
		assert.throws(
			() => targetFor(source + '\n> [!question|unknown] Modern?\n> Example\n', 'Modern?'),
			/duplicated/,
		)
	})

	it('requires an explicit title, supported choices and fully quoted body lines', () => {
		for (const source of [
			'> [!question]\n> Answer\n',
			'> [!question|unknown] Where?\n> Answer\n',
			'> [!question|choice] Where?\n> - [x] River\n>\n> Other: By bus\n',
			'> [!question] Where?\n> Answer\nLazy continuation\n',
			'> [!question] First?\n> Answer\n> [!question] Second?\n> Answer\n',
		])
			assert.ok(!questionBlocks(source).some(canEdit), source)
	})

	it('ignores title questions in fences, quotes, list context and HTML', () => {
		for (const source of [
			'```md\n> [!question] Example?\n> Answer\n```\n',
			'> Quoted example\n>\n> > [!question] Example?\n> > Answer\n',
			'- Context\n  > [!question] Example?\n  > Answer\n',
			'<!--\n> [!question] Example?\n> Answer\n-->\n',
		])
			assert.deepStrictEqual(questionBlocks(source), [])
	})

	it('keeps Other and notes independent and leaves empty note syntax after clearing it', () => {
		const source = '> [!question|choice] Where?\n' + choices + '>\n> Other: By bus\n' + note
		const target = targetFor(source, 'Where?', 'note')
		const changed = writeAnswer(source, targetFor(source, 'Where?'), '- [x] River\n- [ ] Park')
		assert.ok(!changed.includes('Other:'))
		assert.strictEqual(
			writeAnswer(changed, target, 'Ask Monday'),
			changed.replace('Ask Friday', 'Ask Monday'),
		)
		const cleared = writeAnswer(changed, target, '')
		assert.ok(cleared.includes('> > [!note]\n> > \n'))
		assert.strictEqual(questionBlocks(cleared)[0]?.notes[0]?.blank, true)
	})

	it('refuses changed question titles, kind, source and ambiguous copies', () => {
		const source = '> [!question] Where?\n> Tomorrow\n'
		const target = targetFor(source, 'Where?')

		for (const current of [
			source.replace('Where?', 'Elsewhere?'),
			source.replace('[!question]', '[!question]+'),
			source.replace('Tomorrow', 'Friday'),
			source + '\n' + source,
		])
			assert.throws(() => writeAnswer(current, target, 'Saturday'), AnswerError)
	})

	it.effect(
		'uses Vault.process once and preserves CRLF, a concurrent note and missing final newline',
		() =>
			Effect.gen(function* () {
				const source =
					'> [!question|choice]- Which **route**?\r\n' +
					choices.replaceAll('\n', '\r\n') +
					note.replaceAll('\n', '\r\n').trimEnd()

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
					targetFor(source, 'Which **route**?'),
					'- [ ] River\n- [x] Park',
				)

				assert.strictEqual(writes, 1)
				assert.strictEqual(
					saved,
					source.replace('[ ] Park', '[x] Park').replace('Ask Friday', 'Ask Monday'),
				)
			}),
	)
})
