import { assert, describe, it } from '@effect/vitest'

import { sectionTargets } from '#/src/section-targets'

describe('sectionTargets', () => {
	it('uses document line numbers to pair a later section in rendered order', () => {
		const text =
			'# Heading\n\n- [ ] First?\n  > [!answer]\n\n# Later\n\n- [ ] Second?\n  > [!answer]\n'

		assert.deepStrictEqual(
			sectionTargets({ text, lineStart: 7, lineEnd: 8 }, 1).map((block) => block.question),
			['Second?'],
		)
	})

	it('counts filled and completed callouts to keep subsequent targets aligned', () => {
		const text = '- [x] Done?\n  > [!answer]\n  > Already filled\n\n- [ ] Next?\n  > [!answer]\n'
		assert.deepStrictEqual(
			sectionTargets({ text, lineStart: 0, lineEnd: 5 }, 2).map((block) => block.question),
			['Done?', 'Next?'],
		)
	})

	it('refuses mismatched counts or section offsets', () => {
		const text = '- [ ] First?\n  > [!answer]\n'
		assert.deepStrictEqual(sectionTargets({ text, lineStart: 0, lineEnd: 1 }, 2), [])
		assert.deepStrictEqual(sectionTargets({ text, lineStart: 50, lineEnd: 51 }, 1), [])
	})
})
