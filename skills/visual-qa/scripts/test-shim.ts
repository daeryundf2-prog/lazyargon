import assert from "node:assert/strict"
import { describe, test } from "node:test"

export { describe, test }

export function expect<T>(actual: T) {
	return {
		toBe(expected: T) {
			assert.equal(actual, expected)
		},
		toEqual(expected: unknown) {
			assert.deepEqual(actual, expected)
		},
		toBeGreaterThan(expected: number) {
			assert.ok((actual as unknown as number) > expected)
		},
		toBeLessThan(expected: number) {
			assert.ok((actual as unknown as number) < expected)
		},
		toThrow(expected?: string | RegExp) {
			assert.throws(actual as unknown as () => unknown, expected)
		},
	}
}
