import { assert, describe, it } from '@effect/vitest'

import { targetFor, writeAnswer } from '#/src/answer-target'
import { canEdit, questionBlocks } from '#/src/question-blocks'

const source =
	'> [!question|choice] Which route?\n> - [ ] River\n> - [ ] Park\n>\n> > [!note]\n> > Bring water.\n'

const annotated =
	'> [!question|choice] Which route?\n> - [ ] River\n>   > [!note]\n>   > Quieter, but longer.\n> - [ ] Park\n>\n> > [!note]\n> > Bring water.\n'

describe('notes on individual options', () => {
	it('inserts a native nested note under an unchecked option without selecting it', () => {
		const target = targetFor(source, 'Which route?', 'option:River')
		assert.strictEqual(writeAnswer(source, target, 'Quieter, but longer.'), annotated)
		const block = questionBlocks(annotated)[0]
		assert.ok(block !== undefined && canEdit(block))
		assert.strictEqual(block.optionNotes[0]?.notes[0]?.content?.kind, 'text')
		assert.strictEqual(block.notes[0]?.content?.kind, 'text')
		assert.strictEqual(block.slots[0].blank, true)
	})

	it('preserves an option note when a different answer is selected or deselected', () => {
		const selected = writeAnswer(
			annotated,
			targetFor(annotated, 'Which route?'),
			'- [ ] River\n- [x] Park',
		)

		assert.strictEqual(selected, annotated.replace('[ ] Park', '[x] Park'))
		assert.strictEqual(
			writeAnswer(selected, targetFor(selected, 'Which route?'), '- [ ] River\n- [ ] Park'),
			annotated,
		)
	})

	it('keeps current picks when saving an option note opened before the selection changed', () => {
		const target = targetFor(annotated, 'Which route?', 'option:River')
		const current = annotated.replace('[ ] Park', '[x] Park')
		assert.strictEqual(
			writeAnswer(current, target, 'Avoid after rain.'),
			current.replace('Quieter, but longer.', 'Avoid after rain.'),
		)
	})

	it('keeps newly added notes when saving picks opened before the note existed', () => {
		const target = targetFor(source, 'Which route?')
		assert.strictEqual(
			writeAnswer(annotated, target, '- [ ] River\n- [x] Park'),
			annotated.replace('[ ] Park', '[x] Park'),
		)
	})

	it('preserves option notes while adding and clearing a custom answer', () => {
		const custom = writeAnswer(
			annotated,
			targetFor(annotated, 'Which route?'),
			'- [ ] River\n- [ ] Park\n\nOther: Stay home.',
		)

		assert.match(custom, />   > Quieter, but longer\./)
		assert.match(custom, /> Other: Stay home\./)

		const cleared = writeAnswer(
			custom,
			targetFor(custom, 'Which route?'),
			'- [ ] River\n- [ ] Park',
		)

		assert.match(cleared, />   > Quieter, but longer\./)
		assert.ok(!cleared.includes('Other:'))
	})

	it('still refuses changed option source outside the independent notes', () => {
		const target = targetFor(annotated, 'Which route?')
		assert.throws(() =>
			writeAnswer(annotated.replace('[ ] Park', '[ ] Park '), target, '- [x] River\n- [ ] Park'),
		)
	})

	it('edits different option notes independently and preserves the overall note', () => {
		const river = targetFor(annotated, 'Which route?', 'option:River')
		const park = targetFor(annotated, 'Which route?', 'option:Park')
		const withPark = writeAnswer(annotated, park, 'More shade.')
		const result = writeAnswer(withPark, river, 'Less traffic.')
		assert.match(result, /> - \[ \] River\n>   > \[!note\]\n>   > Less traffic\./)
		assert.match(result, /> - \[ \] Park\n>   > \[!note\]\n>   > More shade\./)
		assert.ok(result.endsWith('> > [!note]\n> > Bring water.\n'))
	})

	it('refuses concurrent edits or creation of the same option note', () => {
		const edit = targetFor(annotated, 'Which route?', 'option:River')
		assert.throws(() =>
			writeAnswer(
				annotated.replace('Quieter, but longer.', 'Changed elsewhere.'),
				edit,
				'Overwrite',
			),
		)
		const create = targetFor(source, 'Which route?', 'option:River')
		assert.throws(() => writeAnswer(annotated, create, 'Overwrite'))
	})

	it('refuses an option that was renamed or removed while its editor was open', () => {
		const target = targetFor(source, 'Which route?', 'option:River')
		assert.throws(() => writeAnswer(source.replace('River', 'Canal'), target, 'Wrong option'))
		assert.throws(() =>
			writeAnswer(source.replace('> - [ ] River\n', ''), target, 'Missing option'),
		)
	})

	it('does not treat task syntax or Other inside a note as an answer', () => {
		const note = 'Other: Not a custom answer.\n- [x] Not a pick.'
		const result = writeAnswer(source, targetFor(source, 'Which route?', 'option:River'), note)

		const selected = writeAnswer(
			result,
			targetFor(result, 'Which route?'),
			'- [ ] River\n- [x] Park',
		)

		assert.match(selected, />   > Other: Not a custom answer\./)
		assert.match(selected, />   > - \[x\] Not a pick\./)
		assert.match(selected, /> - \[x\] Park/)
	})

	it.each(['\n', '\r\n'])('preserves line endings and a missing final newline (%j)', (newline) => {
		const original = '> [!question|choices] Bring?\n> - [X] Water\n> - [ ] Snack'.replaceAll(
			'\n',
			newline,
		)

		const result = writeAnswer(
			original,
			targetFor(original, 'Bring?', 'option:Snack'),
			'Nut free.\nEnough for two.',
		)

		assert.strictEqual(
			result,
			'> [!question|choices] Bring?\n> - [X] Water\n> - [ ] Snack\n>   > [!note]\n>   > Nut free.\n>   > Enough for two.'.replaceAll(
				'\n',
				newline,
			),
		)
		assert.strictEqual(
			writeAnswer(result, targetFor(original, 'Bring?'), '- [x] Water\n- [x] Snack'),
			result.replace('[ ] Snack', '[x] Snack'),
		)
	})

	it('refuses duplicate option notes and unsupported list content', () => {
		const duplicate = annotated.replace(
			'> - [ ] Park',
			'>   >\n>   > [!note]\n>   > Second note.\n> - [ ] Park',
		)

		assert.throws(() => targetFor(duplicate, 'Which route?', 'option:River'))
		assert.throws(() =>
			targetFor(
				source.replace('> - [ ] River', '> - [ ] River\n>   Extra paragraph.'),
				'Which route?',
			),
		)
	})
})
