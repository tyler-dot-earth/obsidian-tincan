import { assert, it } from '@effect/vitest'

import { targetFor } from '#/src/answer-target'
import { confirmNoteSave } from '#/src/confirm-discard'
import { Draft } from '#/src/drafts'

const confirm = (): Promise<boolean> => {
	throw new Error('Unexpected confirmation')
}

const source = '> [!question] When?\n> Before dinner.\n>\n> > [!note]\n> > Check the weather.\n'

it('asks before clearing an existing note, keeps its draft on cancellation', async () => {
	const draft = new Draft(targetFor(source, 'When?', 'note'))
	draft.text = ''

	const accepted = await confirmNoteSave(draft, (request) => {
		assert.strictEqual(request.text, 'Check the weather.')
		assert.strictEqual(request.action, 'Clear note')

		return Promise.resolve(false)
	})

	assert.strictEqual(accepted, false)
	assert.strictEqual(draft.text, '')
	assert.strictEqual(draft.target.answer?.content?.kind, 'text')
})

it('allows clearing a note only after confirmation', async () => {
	const draft = new Draft(targetFor(source, 'When?', 'note'))
	draft.text = '   '
	assert.strictEqual(await confirmNoteSave(draft, () => Promise.resolve(true)), true)
})

it('does not prompt for nonempty note edits or new notes', async () => {
	const draft = new Draft(targetFor(source, 'When?', 'note'))
	draft.text = 'Bring an umbrella.'
	assert.strictEqual(await confirmNoteSave(draft, confirm), true)
	const missing = new Draft(targetFor('> [!question] When?\n> Before dinner.\n', 'When?', 'note'))
	assert.strictEqual(await confirmNoteSave(missing, confirm), true)
})

it('does not reuse a confirmation after the draft changes', async () => {
	const draft = new Draft(targetFor(source, 'When?', 'note'))
	draft.text = ''

	const accepted = await confirmNoteSave(draft, () => {
		draft.text = 'A newer draft.'

		return Promise.resolve(true)
	})

	assert.strictEqual(accepted, false)
	assert.strictEqual(draft.text, 'A newer draft.')
})
