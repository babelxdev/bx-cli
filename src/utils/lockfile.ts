/**
 * Lockfile system for tracking translation changes
 * Similar to i18n.lock in Lingo.dev
 * Stores MD5 checksums of source strings to detect deltas
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";

interface LockEntry {
	hash: string;
	timestamp: number;
}

interface LockfileData {
	version: number;
	entries: Record<string, LockEntry>;
}

const LOCKFILE_VERSION = 1;
const LOCKFILE_NAME = ".babelx.lock";

function getLockfilePath(cwd: string = process.cwd()): string {
	return join(cwd, LOCKFILE_NAME);
}

function md5(content: string): string {
	return createHash("md5").update(content).digest("hex");
}

async function loadLockfile(cwd?: string): Promise<LockfileData> {
	const lockPath = getLockfilePath(cwd);

	if (!existsSync(lockPath)) {
		return { version: LOCKFILE_VERSION, entries: {} };
	}

	try {
		const content = await Bun.file(lockPath).text();
		const data = JSON.parse(content) as LockfileData;

		if (data.version !== LOCKFILE_VERSION) {
			return { version: LOCKFILE_VERSION, entries: {} };
		}

		return data;
	} catch {
		return { version: LOCKFILE_VERSION, entries: {} };
	}
}

async function saveLockfile(data: LockfileData, cwd?: string): Promise<void> {
	const lockPath = getLockfilePath(cwd);
	await Bun.write(lockPath, JSON.stringify(data, null, 2));
}

export interface Delta {
	added: string[];
	removed: string[];
	updated: string[];
	renamed: Array<[string, string]>;
	hasChanges: boolean;
}

/**
 * Calculate delta between current source and lockfile
 */
export async function calculateDelta(
	currentData: Record<string, string>,
	cwd?: string,
): Promise<Delta> {
	const lockfile = await loadLockfile(cwd);
	const currentKeys = Object.keys(currentData);
	const lockedKeys = Object.keys(lockfile.entries);

	// Find added and removed keys
	let added = currentKeys.filter((key) => !lockedKeys.includes(key));
	let removed = lockedKeys.filter((key) => !currentKeys.includes(key));

	// Find updated keys (same key, different content)
	const updated = currentKeys.filter((key) => {
		if (!lockfile.entries[key]) return false;
		const currentValue = currentData[key];
		if (!currentValue) return false;
		const currentHash = md5(currentValue);
		return currentHash !== lockfile.entries[key].hash;
	});

	// Detect renamed keys (same hash, different key name)
	const renamed: Array<[string, string]> = [];
	const currentHashes = new Map<string, string>();

	for (const [key, value] of Object.entries(currentData)) {
		currentHashes.set(md5(value), key);
	}

	for (const removedKey of removed) {
		const removedHash = lockfile.entries[removedKey]?.hash;
		if (!removedHash) continue;

		const matchingNewKey = currentHashes.get(removedHash);
		if (matchingNewKey && added.includes(matchingNewKey)) {
			renamed.push([removedKey, matchingNewKey]);
		}
	}

	// Remove renamed keys from added/removed lists
	added = added.filter((key) => !renamed.some(([, newKey]) => newKey === key));
	removed = removed.filter(
		(key) => !renamed.some(([oldKey]) => oldKey === key),
	);

	return {
		added,
		removed,
		updated,
		renamed,
		hasChanges:
			added.length > 0 ||
			removed.length > 0 ||
			updated.length > 0 ||
			renamed.length > 0,
	};
}

/**
 * Update lockfile with current data
 */
export async function updateLockfile(
	data: Record<string, string>,
	cwd?: string,
): Promise<void> {
	const lockfile = await loadLockfile(cwd);

	for (const [key, value] of Object.entries(data)) {
		lockfile.entries[key] = {
			hash: md5(value),
			timestamp: Date.now(),
		};
	}

	await saveLockfile(lockfile, cwd);
}

/**
 * Remove keys from lockfile
 */
export async function removeFromLockfile(
	keys: string[],
	cwd?: string,
): Promise<void> {
	const lockfile = await loadLockfile(cwd);

	for (const key of keys) {
		delete lockfile.entries[key];
	}

	await saveLockfile(lockfile, cwd);
}

/**
 * Get lockfile statistics
 */
export async function getLockfileStats(cwd?: string): Promise<{
	entries: number;
	lastUpdated: number | null;
}> {
	const lockfile = await loadLockfile(cwd);
	const entries = Object.values(lockfile.entries);

	return {
		entries: entries.length,
		lastUpdated:
			entries.length > 0 ? Math.max(...entries.map((e) => e.timestamp)) : null,
	};
}

/**
 * Clear lockfile
 */
export async function clearLockfile(cwd?: string): Promise<void> {
	await saveLockfile({ version: LOCKFILE_VERSION, entries: {} }, cwd);
}
