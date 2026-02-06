/**
 * Simple JSON-based cache for translations
 * Avoids re-translating same strings
 */

import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

interface CacheEntry {
	sourceText: string;
	translatedText: string;
	sourceLang: string;
	targetLang: string;
	timestamp: number;
	// Simple content hash for detecting changes
	hash: string;
}

interface CacheData {
	version: number;
	entries: Record<string, CacheEntry>;
}

const CACHE_VERSION = 1;
const CACHE_FILENAME = ".babelx-cache.json";

function getCachePath(): string {
	// Store cache in home directory
	const cacheDir = join(homedir(), ".babelx");

	if (!existsSync(cacheDir)) {
		mkdirSync(cacheDir, { recursive: true });
	}

	return join(cacheDir, CACHE_FILENAME);
}

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return hash.toString(36);
}

async function loadCache(): Promise<CacheData> {
	const cachePath = getCachePath();

	if (!existsSync(cachePath)) {
		return { version: CACHE_VERSION, entries: {} };
	}

	try {
		const content = await Bun.file(cachePath).text();
		const data = JSON.parse(content) as CacheData;

		if (data.version !== CACHE_VERSION) {
			return { version: CACHE_VERSION, entries: {} };
		}

		return data;
	} catch {
		return { version: CACHE_VERSION, entries: {} };
	}
}

async function saveCache(cache: CacheData): Promise<void> {
	const cachePath = getCachePath();
	await Bun.write(cachePath, JSON.stringify(cache, null, 2));
}

function makeCacheKey(
	sourceText: string,
	sourceLang: string,
	targetLang: string,
): string {
	const hash = simpleHash(`${sourceText}:${sourceLang}:${targetLang}`);
	return `${sourceLang}:${targetLang}:${hash}`;
}

/**
 * Check if a translation exists in cache
 */
export async function getCachedTranslation(
	sourceText: string,
	sourceLang: string,
	targetLang: string,
): Promise<string | null> {
	const cache = await loadCache();
	const key = makeCacheKey(sourceText, sourceLang, targetLang);
	const entry = cache.entries[key];

	if (!entry) return null;

	// Verify the source text matches (extra safety)
	if (entry.sourceText === sourceText) {
		return entry.translatedText;
	}

	return null;
}

/**
 * Store a translation in cache
 */
export async function setCachedTranslation(
	sourceText: string,
	translatedText: string,
	sourceLang: string,
	targetLang: string,
): Promise<void> {
	const cache = await loadCache();
	const key = makeCacheKey(sourceText, sourceLang, targetLang);

	cache.entries[key] = {
		sourceText,
		translatedText,
		sourceLang,
		targetLang,
		timestamp: Date.now(),
		hash: simpleHash(sourceText),
	};

	await saveCache(cache);
}

/**
 * Cache multiple translations at once
 */
export async function setCachedTranslations(
	items: Array<{
		sourceText: string;
		translatedText: string;
		sourceLang: string;
		targetLang: string;
	}>,
): Promise<void> {
	const cache = await loadCache();

	for (const item of items) {
		const key = makeCacheKey(item.sourceText, item.sourceLang, item.targetLang);

		cache.entries[key] = {
			sourceText: item.sourceText,
			translatedText: item.translatedText,
			sourceLang: item.sourceLang,
			targetLang: item.targetLang,
			timestamp: Date.now(),
			hash: simpleHash(item.sourceText),
		};
	}

	await saveCache(cache);
}

/**
 * Clear the entire cache
 */
export async function clearCache(): Promise<void> {
	const cache: CacheData = { version: CACHE_VERSION, entries: {} };
	await saveCache(cache);
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
	size: number;
	languages: string[];
}> {
	const cache = await loadCache();
	const entries = Object.values(cache.entries);

	const langPairs = new Set<string>();
	for (const entry of entries) {
		langPairs.add(`${entry.sourceLang}->${entry.targetLang}`);
	}

	return {
		size: entries.length,
		languages: Array.from(langPairs),
	};
}
