import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		exclude: ['dist/**', 'node_modules/**', 'coverage/**'],
		include: ['src/**/*.test.ts'],
		setupFiles: ['./vitest.setup.ts'],
		env: { TZ: 'UTC' },
	},
})
