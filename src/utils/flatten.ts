/**
 * Flatten/unflatten nested objects for translation
 * Converts { a: { b: { c: "text" } } } to { "a.b.c": "text" }
 */

export type FlattenedObject = Record<string, string>;

/**
 * Flatten a nested object into dot-notation keys
 * Only string values are included (numbers, booleans, objects are recursed)
 */
export function flatten(obj: unknown, prefix = ""): FlattenedObject {
	const result: FlattenedObject = {};

	if (obj === null || obj === undefined) {
		return result;
	}

	if (typeof obj === "string") {
		result[prefix] = obj;
		return result;
	}

	if (Array.isArray(obj)) {
		for (let i = 0; i < obj.length; i++) {
			const key = prefix ? `${prefix}.${i}` : String(i);
			const flattened = flatten(obj[i], key);
			Object.assign(result, flattened);
		}
		return result;
	}

	if (typeof obj === "object") {
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			const newKey = prefix ? `${prefix}.${key}` : key;
			const flattened = flatten(value, newKey);
			Object.assign(result, flattened);
		}
		return result;
	}

	// For numbers, booleans, etc - convert to string
	if (prefix) {
		result[prefix] = String(obj);
	}

	return result;
}

/**
 * Unflatten dot-notation keys back into nested object
 * Converts { "a.b.c": "text" } to { a: { b: { c: "text" } } }
 */
export function unflatten(flat: FlattenedObject): unknown {
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(flat)) {
		const parts = key.split(".");
		let current: Record<string, unknown> = result;

		for (let i = 0; i < parts.length - 1; i++) {
			const part = parts[i];
			if (!part) continue;

			// Check if next part is a number (array index)
			const nextPart = parts[i + 1];
			const isNextArrayIndex = nextPart ? /^\d+$/.test(nextPart) : false;

			if (!(part in current)) {
				current[part] = isNextArrayIndex ? [] : {};
			}

			current = current[part] as Record<string, unknown>;
		}

		const lastPart = parts[parts.length - 1];
		if (lastPart) {
			current[lastPart] = value;
		}
	}

	return convertArrays(result);
}

/**
 * Convert array-like objects back to actual arrays
 * { "0": "a", "1": "b" } → ["a", "b"]
 */
function convertArrays(obj: unknown): unknown {
	if (obj === null || typeof obj !== "object") {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map(convertArrays);
	}

	const record = obj as Record<string, unknown>;
	const keys = Object.keys(record);

	// Check if all keys are consecutive integers starting from 0
	const isArray =
		keys.length > 0 &&
		keys.every((k, i) => k === String(i)) &&
		keys.length === Number(keys[keys.length - 1]) + 1;

	if (isArray) {
		return keys.map((k) => convertArrays(record[k]));
	}

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(record)) {
		result[key] = convertArrays(value);
	}

	return result;
}

/**
 * Get all leaf keys from a nested object (for finding new keys)
 */
export function getLeafKeys(obj: unknown, prefix = ""): string[] {
	const keys: string[] = [];

	if (obj === null || obj === undefined) {
		return keys;
	}

	if (typeof obj === "string") {
		if (prefix) keys.push(prefix);
		return keys;
	}

	if (Array.isArray(obj)) {
		for (let i = 0; i < obj.length; i++) {
			const key = prefix ? `${prefix}.${i}` : String(i);
			keys.push(...getLeafKeys(obj[i], key));
		}
		return keys;
	}

	if (typeof obj === "object") {
		for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
			const newKey = prefix ? `${prefix}.${key}` : key;
			keys.push(...getLeafKeys(value, newKey));
		}
		return keys;
	}

	return keys;
}
