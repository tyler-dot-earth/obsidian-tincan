import { assert, describe, it } from '@effect/vitest'

import { sectionTargets } from '#/src/section-targets'

describe('sectionTargets', () => {
	it('uses document line numbers to pair a later section in rendered order', () => {
		const text = '# Heading\n\n> [!question] First?\n\n# Later\n\n> [!question] Second?\n'

		assert.deepStrictEqual(
			sectionTargets({ text, lineStart: 6, lineEnd: 6 }, 1).map((block) => block.question),
			['Second?'],
		)
	})

	it('counts filled and unanswered callouts to keep subsequent targets aligned', () => {
		const text = '> [!question] Done?\n> Already filled\n\n> [!question] Next?\n'
		assert.deepStrictEqual(
			sectionTargets({ text, lineStart: 0, lineEnd: 5 }, 2).map((block) => block.question),
			['Done?', 'Next?'],
		)
	})

	it('refuses mismatched counts or section offsets', () => {
		const text = '> [!question] First?\n'
		assert.deepStrictEqual(sectionTargets({ text, lineStart: 0, lineEnd: 1 }, 2), [])
		assert.deepStrictEqual(sectionTargets({ text, lineStart: 50, lineEnd: 51 }, 1), [])
	})
})
