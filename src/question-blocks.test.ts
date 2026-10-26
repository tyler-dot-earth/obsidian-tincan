import { assert, describe, it } from '@effect/vitest'

import { AnswerError, targetFor } from '#/src/answer-target'
import { canAnnotate, canAnswer, canEdit, questionBlocks } from '#/src/question-blocks'
import { sectionTargets } from '#/src/section-targets'

describe('questionBlocks', () => {
	it('keeps unsupported kinds in source order and duplicate checks', () => {
		const unsupported = '> [!question|unknown] Q?\n> Tomorrow\n'
		const current = '> [!question] Current?\n> 🤖 After lunch\n'
		assert.deepStrictEqual(
			sectionTargets({ text: unsupported + '\n' + current, lineStart: 0, lineEnd: 20 }, 2).map(
				(block) => block.question,
			),
			['Q?', 'Current?'],
		)
		assert.throws(() => targetFor(unsupported, 'Q?'), AnswerError)
		assert.throws(
			() => targetFor(unsupported + '\n' + current.replace('Current?', 'Q?'), 'Q?'),
			/duplicated/,
		)
	})

	it('uses the question header for identity and source offsets', () => {
		const source = 'Context above.\n\n> [!question]- Which route?\n>\n\n> [!question] When?\n'
		const blocks = questionBlocks(source)
		assert.deepStrictEqual(
			blocks.map((block) => [block.question, canAnswer(block)]),
			[
				['Which route?', true],
				['When?', true],
			],
		)
		assert.strictEqual(blocks[0]?.line, 2)
		assert.strictEqual(blocks[0]?.slots[0].source, '> [!question]- Which route?\n>\n')
		assert.strictEqual(blocks[0]?.context, '> [!question]- Which route?')
	})

	it('ignores metadata, fenced and indented code, HTML, quotes, and list-contained callouts', () => {
		const source =
			'---\nexample: |\n  > [!question] YAML?\n---\n\n```md\n> [!question] Fenced?\n```\n\n    > [!question] Code?\n\n<!--\n> [!question] Comment?\n-->\n\n> Quoted example\n>\n> > [!question] Quoted?\n\n- Context\n  > [!question] Listed?\n\n> [!question] Real?\n'

		assert.deepStrictEqual(
			questionBlocks(source).map((block) => block.question),
			['Real?'],
		)
	})

	it('preserves supported callout indentation', () => {
		const block = questionBlocks('  > [!question] Indented?\n  >\n')[0]
		assert.ok(block !== undefined && canAnswer(block))
		assert.strictEqual(block.slots[0].prefix, '  >')
	})

	it('treats text, nested quotes, lists, and recommendations as filled text answers', () => {
		for (const content of ['> Existing', '>> Nested', '> - one\n> - two', '> 🤖 Tomorrow']) {
			const block = questionBlocks(`> [!question] Filled?\n${content}\n`)[0]
			assert.ok(block !== undefined && canEdit(block) && !canAnswer(block), content)
		}
	})

	it('refuses controls for lazy body lines and merged question headers', () => {
		for (const body of ['> Existing\nLazy text\n', '> First\n> [!question] Second?\n> Answer\n']) {
			const source = '> [!question] Q?\n' + body
			const block = questionBlocks(source)[0]
			assert.ok(block !== undefined && !canEdit(block) && !canAnnotate(block))
			assert.throws(() => targetFor(source, 'Q?'), AnswerError)
		}
	})

	it('requires a standalone callout with an explicit title', () => {
		for (const source of [
			'- [ ] Task?\n  > Ordinary quote\n',
			'> [!question]\n> Answer\n',
			'> [!note] Not a question\n',
		])
			assert.deepStrictEqual(questionBlocks(source), [])
	})
})
