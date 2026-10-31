import { assert, describe, it } from '@effect/vitest'

import { AnswerError, targetFor, writeAnswer } from '#/src/answer-target'
import { canAnnotate, canEdit, questionBlocks } from '#/src/question-blocks'
import { sectionTargets } from '#/src/section-targets'

const base =
	'> [!question|choice] Walk?\n> - [ ] 🤖 Short walk\n> - [ ] Long walk\n>\n> Other: A picnic in the park\n'

const note = '>\n> > [!note]\n> > Leaning A; ask after X\n'

describe('notes within an answer', () => {
	it.each(['\n', '\r\n'])(
		'creates a trailing note with %j line endings while preserving the answer and surrounding bytes',
		(newline) => {
			const question =
				['  > [!question|choice] Walk?', '  > - [x] River', '  > - [ ] Park', '  >'].join(newline) +
				newline

			const source = 'Before' + newline + newline + question + newline + 'After' + newline
			const target = targetFor(source, 'Walk?', 'note')

			const inserted =
				['  >', '  > > [!note]', '  > > Check weather', '  > > Ask Friday'].join(newline) + newline

			const saved = writeAnswer(source, target, 'Check weather\nAsk Friday')
			assert.strictEqual(saved, source.replace(question, question + inserted))
			assert.strictEqual(
				targetFor(saved, 'Walk?').answer?.source,
				targetFor(source, 'Walk?').answer?.source,
			)
		},
	)

	it('creates a note without adding a final newline, using the latest independent answer', () => {
		const source = '> [!question] When?\n> Tomorrow'
		const target = targetFor(source, 'When?', 'note')
		const latest = source.replace('Tomorrow', 'Friday')
		assert.strictEqual(
			writeAnswer(latest, target, 'Check Monday'),
			latest + '\n>\n> > [!note]\n> > Check Monday',
		)
	})

	it('refuses an empty new note, a concurrently added note, and duplicated questions', () => {
		const target = targetFor(base, 'Walk?', 'note')
		assert.throws(() => writeAnswer(base, target, '   '), AnswerError)
		assert.throws(() => writeAnswer(base + note, target, 'Replace it'), AnswerError)
		assert.throws(() => writeAnswer(base + '\n' + base, target, 'Guess'), AnswerError)
	})

	it('parses answer and trailing note independently, including Other-only answers', () => {
		const blocks = questionBlocks(base + note)
		const block = blocks[0]
		assert.ok(block !== undefined && canEdit(block) && canAnnotate(block))
		assert.strictEqual(block.slots[0]?.source, base.slice(base.indexOf('>')))
		assert.strictEqual(block.slots[0]?.content?.kind, 'choice')
		const content = block.slots[0]?.content
		assert.strictEqual(
			content?.kind === 'choice' ? content.other : undefined,
			'A picnic in the park',
		)
		assert.strictEqual(block.notes[0]?.source, note)
		assert.deepStrictEqual(block.notes[0]?.content, {
			kind: 'text',
			text: 'Leaning A; ask after X',
		})
		assert.strictEqual(
			sectionTargets({ text: base + note, lineStart: 0, lineEnd: 100 }, 1).length,
			1,
		)
	})

	it('adds a note inside the existing answer and keeps its earlier answer snapshot valid', () => {
		const answer = targetFor(base, 'Walk?')
		const seeded = base + '>\n> > [!note]\n> >\n'
		const comment = targetFor(seeded, 'Walk?', 'note')
		const withNote = writeAnswer(seeded, comment, 'Leaning A; ask after X')
		assert.strictEqual(withNote, base + note)

		const both = writeAnswer(
			withNote,
			answer,
			'- [ ] 🤖 Short walk\n- [ ] Long walk\n\nOther: A different picnic',
		)

		assert.strictEqual(both, (base + note).replace('A picnic in the park', 'A different picnic'))
	})

	it('edits and clears nested notes without touching typed answers, options, or question titles', () => {
		const source = base + note
		const changed = writeAnswer(source, targetFor(source, 'Walk?', 'note'), 'Ask after Friday')
		assert.strictEqual(changed, source.replace('Leaning A; ask after X', 'Ask after Friday'))
		assert.throws(
			() => writeAnswer(changed, targetFor(source, 'Walk?', 'note'), 'Stale'),
			AnswerError,
		)
		const cleared = writeAnswer(changed, targetFor(changed, 'Walk?', 'note'), '')
		assert.strictEqual(cleared, base + '>\n> > [!note]\n> > \n')
		assert.strictEqual(
			targetFor(cleared, 'Walk?').answer?.source,
			targetFor(base, 'Walk?').answer?.source,
		)
	})

	it('keeps CRLF and a missing final newline while editing a typed answer', () => {
		const source = '> [!question] When?\r\n> Tomorrow\r\n>\r\n> > [!note]\r\n> > Ask again'

		const saved = writeAnswer(source, targetFor(source, 'When?'), 'Friday')
		assert.strictEqual(saved, source.replace('Tomorrow', 'Friday'))
		assert.strictEqual(
			writeAnswer(saved, targetFor(saved, 'When?', 'note'), 'Check Monday'),
			saved.replace('Ask again', 'Check Monday'),
		)
	})

	it('keeps code examples as answer text and refuses malformed or duplicate note fields', () => {
		const code = '> [!question] Q?\n> ```md\n> > [!note]\n> > Example\n> ```\n'
		assert.strictEqual(questionBlocks(code)[0]?.notes.length, 0)
		const duplicate = base + note + '>\n> > [!note]\n> > Second note\n'
		assert.throws(() => targetFor(duplicate, 'Walk?', 'note'), AnswerError)
	})
})
