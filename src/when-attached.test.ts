// @vitest-environment happy-dom
import { assert, describe, it } from '@effect/vitest'
import { vi } from 'vitest'

import { whenAttached } from '#/src/when-attached'

describe('section attachment', () => {
	it('mounts an attached section immediately', () => {
		const element = document.createElement('div')
		document.body.append(element)
		let mounts = 0

		const dispose = whenAttached(element, () => {
			mounts += 1
		})

		assert.strictEqual(mounts, 1)
		dispose()
		element.remove()
	})

	it('waits for detached postprocessor DOM and mounts only once', async () => {
		const element = document.createElement('div')
		let mounts = 0

		const dispose = whenAttached(element, () => {
			mounts += 1
		})

		assert.strictEqual(mounts, 0)
		document.body.append(element)
		await vi.waitFor(() => {
			assert.strictEqual(mounts, 1)
		})
		element.append(document.createElement('p'))
		await Promise.resolve()
		assert.strictEqual(mounts, 1)
		dispose()
		element.remove()
	})

	it('does not mount a section unloaded before attachment', async () => {
		const element = document.createElement('div')
		let mounts = 0

		const dispose = whenAttached(element, () => {
			mounts += 1
		})

		dispose()
		document.body.append(element)
		await new Promise((resolve) => {
			setTimeout(resolve, 0)
		})
		assert.strictEqual(mounts, 0)
		element.remove()
	})
})
