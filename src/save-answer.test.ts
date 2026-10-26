import { assert, describe, it } from '@effect/vitest'
import { Effect } from 'effect'

import { targetFor } from '#/src/answer-target'
import { Drafts } from '#/src/drafts'
import { type AnswerWriter, saveAnswer } from '#/src/save-answer'

const note = '- [ ] Which?\n  > [!answer]\n'

const target = targetFor(note, 'Which?')

/** The fake is the Vault boundary; parsing, validation, and transformation are real. */
class MemoryVault implements AnswerWriter {
	source = note
	exists = true
	inEditor = false
	writeFails = false
	writes = 0
	available = (): boolean => this.exists
	editing = (): boolean => this.inEditor
	process = (transform: (source: string) => string): Promise<string> => {
		return new Promise((resolve, reject) => {
			if (this.writeFails) {
				reject(new Error('Read-only volume'))

				return
			}

			this.source = transform(this.source)
			this.writes += 1
			resolve(this.source)
		})
	}
}

describe('saveAnswer', () => {
	it.effect('uses current Vault.process content and writes once on Done', () =>
		Effect.gen(function* () {
			const vault = new MemoryVault()
			const drafts = new Drafts<string>()
			const draft = drafts.get('original.md', target)
			draft.text = 'The second option'
			vault.source = '# Inserted by another writer\n\n' + note
			assert.strictEqual(vault.writes, 0)
			yield* saveAnswer(vault, draft.target, draft.text)
			assert.strictEqual(
				vault.source,
				'# Inserted by another writer\n\n- [ ] Which?\n  > [!answer]\n  > The second option\n',
			)
			assert.strictEqual(vault.writes, 1)
		}),
	)

	it.effect(
		'refuses a duplicate introduced after typing without changing the source or draft',
		() =>
			Effect.gen(function* () {
				const vault = new MemoryVault()
				const draft = new Drafts<string>().get('original.md', target)
				draft.text = 'Keep me'
				vault.source = note + '\n' + note
				const failure = yield* Effect.flip(saveAnswer(vault, draft.target, draft.text))
				assert.match(failure.message, /duplicated/)
				assert.strictEqual(vault.source, note + '\n' + note)
				assert.strictEqual(vault.writes, 0)
				assert.strictEqual(draft.text, 'Keep me')
			}),
	)

	it.effect('refuses a deleted file and an editable copy before writing', () =>
		Effect.gen(function* () {
			for (const state of ['deleted', 'editing']) {
				const vault = new MemoryVault()
				vault.exists = state !== 'deleted'
				vault.inEditor = state === 'editing'
				const failure = yield* Effect.flip(saveAnswer(vault, target, 'Draft'))
				assert.ok(failure.message.length > 0)
				assert.strictEqual(vault.writes, 0)
				assert.strictEqual(vault.source, note)
			}
		}),
	)

	it.effect('reports a write failure and allows retrying the same draft', () =>
		Effect.gen(function* () {
			const vault = new MemoryVault()
			const draft = new Drafts<string>().get('original.md', target)
			draft.text = 'Retry me'
			vault.writeFails = true
			const failure = yield* Effect.flip(saveAnswer(vault, draft.target, draft.text))
			assert.match(failure.message, /Could not save/)
			assert.strictEqual(draft.text, 'Retry me')
			vault.writeFails = false
			yield* saveAnswer(vault, draft.target, draft.text)
			assert.strictEqual(vault.source, '- [ ] Which?\n  > [!answer]\n  > Retry me\n')
		}),
	)
})

it.effect('edits the saved text answer once and refuses a concurrent answer change', () =>
	Effect.gen(function* () {
		const vault = new MemoryVault()

		const source =
			'- [ ] What should we do this weekend?\n  > [!answer]\n  > A picnic in the park\n'

		vault.source = source
		const opened = targetFor(source, 'What should we do this weekend?')
		const draft = new Drafts<string>().get('original.md', opened)
		assert.strictEqual(draft.text, 'A picnic in the park')
		draft.text = 'A walk by the river'
		vault.source = source.replace('A picnic in the park', 'Someone else’s answer')
		const failure = yield* Effect.flip(saveAnswer(vault, draft.target, draft.text))
		assert.match(failure.message, /answer changed/)
		assert.strictEqual(vault.writes, 0)
		assert.strictEqual(
			vault.source,
			source.replace('A picnic in the park', 'Someone else’s answer'),
		)
		assert.strictEqual(draft.text, 'A walk by the river')
		vault.source = '# Earlier lines moved\n\n' + source
		yield* saveAnswer(vault, draft.target, draft.text)
		assert.strictEqual(vault.writes, 1)
		assert.strictEqual(
			vault.source,
			'# Earlier lines moved\n\n' + source.replace('A picnic in the park', 'A walk by the river'),
		)
	}),
)

it.effect('keeps choice edits on write failure, then retries through the real writer', () =>
	Effect.gen(function* () {
		const vault = new MemoryVault()
		vault.source = '- [ ] Which?\n  > [!answer|choice]\n  > - [x] River\n  > - [ ] Park\n'
		const draft = new Drafts<string>().get('original.md', targetFor(vault.source, 'Which?'))
		draft.text = '- [ ] River\n- [x] Park'
		vault.writeFails = true
		yield* Effect.flip(saveAnswer(vault, draft.target, draft.text))
		assert.strictEqual(vault.writes, 0)
		assert.strictEqual(draft.text, '- [ ] River\n- [x] Park')
		vault.writeFails = false
		yield* saveAnswer(vault, draft.target, draft.text)
		assert.strictEqual(vault.writes, 1)
		assert.strictEqual(
			vault.source,
			'- [ ] Which?\n  > [!answer|choice]\n  > - [ ] River\n  > - [x] Park\n',
		)
	}),
)
