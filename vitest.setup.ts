import { addEqualityTesters } from '@effect/vitest'

addEqualityTesters()

// Obsidian code calls window timers; Node has no window.
Object.assign(globalThis, { window: globalThis })
