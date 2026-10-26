import { assert, describe, it } from '@effect/vitest'

import { AnswerError, targetFor } from '#/src/answer-target'
import { canAnnotate, canAnswer, canEdit, questionBlocks } from '#/src/question-blocks'
import { sectionTargets } from '#/src/section-targets'

describe('questionBlocks', () => {
	it('leaves unsupported question context without answer or note controls', () => {
		for (const context of [
			'  - 🤖 Tomorrow\n\n  > [!answer]\n',
			'  - [ ] 🤖 Tomorrow\n\n  > [!answer]\n',
			'  - [x] 🤖 Tomorrow\n\n  > [!answer]\n',
			'  > [!aside]\n  > Ask Friday\n',
			'  > [!answer]\n\n  > [!aside]\n  > Ask Friday\n',
		]) {
			const source = '- [ ] Q?\n' + context
			const block = questionBlocks(source)[0]
			assert.ok(block !== undefined)
			assert.strictEqual(canEdit(block), false)
			assert.strictEqual(canAnnotate(block), false)
			assert.throws(() => targetFor(source, 'Q?'), AnswerError)
			assert.throws(() => targetFor(source, 'Q?', 'note'), AnswerError)
		}
	})

	it('keeps unsupported questions in source-order and duplicate checks', () => {
		const plain = '- [ ] Q?\n  - 🤖 Tomorrow\n\n  > [!answer]\n'
		const current = '- [ ] Current?\n  > [!answer]\n  > 🤖 After lunch\n'
		const source = plain + '\n' + current
		assert.deepStrictEqual(
			sectionTargets({ text: source, lineStart: 0, lineEnd: 20 }, 2).map((block) => block.question),
			['Q?', 'Current?'],
		)
		assert.throws(
			() => targetFor(plain + '\n' + current.replace('Current?', 'Q?'), 'Q?'),
			/duplicated/,
		)
	})

	it('associates a direct callout with its question across context', () => {
		const blocks = questionBlocks(
			'- [ ] Which route?\n  - context: Choose one.\n\n  > [!answer]\n  >\n\n- [ ] When?\n  > [!answer]\n',
		)

		assert.deepStrictEqual(
			blocks.map((block) => [block.question, block.slots.length, canAnswer(block)]),
			[
				['Which route?', 1, true],
				['When?', 1, true],
			],
		)
		assert.strictEqual(blocks[0]?.slots[0]?.line, 3)
	})

	it('ignores frontmatter, code fences, indented code, HTML, and quoted questions', () => {
		const source =
			'---\nexample: |\n  - [ ] YAML?\n    > [!answer]\n---\n\n```md\n- [ ] Fenced?\n  > [!answer]\n```\n\n    - [ ] Code?\n      > [!answer]\n\n<!--\n- [ ] Comment?\n  > [!answer]\n-->\n\n> - [ ] Quoted?\n>   > [!answer]\n\n- [ ] Real?\n  > [!answer]\n'

		assert.deepStrictEqual(
			questionBlocks(source).map((block) => block.question),
			['Real?'],
		)
	})

	it('finds nested questions without attaching their slots to an outer question', () => {
		const blocks = questionBlocks('- [ ] Outer?\n  - [ ] Inner?\n    > [!answer]\n')
		assert.strictEqual(blocks[0]?.slots.length, 0)
		assert.strictEqual(blocks[1]?.slots.length, 1)
		assert.ok(blocks[1] !== undefined && canAnswer(blocks[1]))
	})

	it('recognizes tabs in list continuation indentation', () => {
		const blocks = questionBlocks('- [ ] Tabbed?\n\t> [!answer]\n\t>\n')
		assert.ok(blocks[0] !== undefined && canAnswer(blocks[0]))
		assert.strictEqual(blocks[0]?.slots[0]?.prefix, '\t>')
	})

	it('treats text, nested quotes, lists, and lazy continuation as filled answers', () => {
		for (const content of ['  > Existing', '  >> Nested', '  > - one\n  > - two', '  Lazy text']) {
			const blocks = questionBlocks(`- [ ] Filled?\n  > [!answer]\n${content}\n`)
			assert.ok(blocks[0] !== undefined && !canAnswer(blocks[0]), content)
		}
	})

	it('keeps completed questions editable', () => {
		assert.ok(questionBlocks('- [x] Done?\n  > [!answer]\n').some(canAnswer))
	})

	it('allows ordinary checked subtasks in question context', () => {
		const blocks = questionBlocks(
			'- [ ] Pick?\n  - [x] Gather context\n\n  > [!answer]- Your answer\n  >\n',
		)

		assert.ok(blocks[0] !== undefined && canAnswer(blocks[0]))
	})

	it('refuses multiple answer callouts and ignores callouts inside examples', () => {
		const multiple = questionBlocks('- [ ] Pick?\n  > [!answer]\n\n  > [!answer]\n')
		assert.ok(!multiple.some(canAnswer))
		const example = questionBlocks('- [ ] Example?\n  ```md\n  > [!answer]\n  ```\n')
		assert.strictEqual(example[0]?.slots.length, 0)
	})

	it('requires a task parent', () => {
		assert.deepStrictEqual(questionBlocks('Question?\n\n> [!answer]\n'), [])
	})
})
