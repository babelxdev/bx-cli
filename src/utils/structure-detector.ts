/**
 * Auto-detect i18n structure type from project files
 * Supports: directory, file, suffix
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export type I18nStructure =
	| "directory"
	| "file"
	| "suffix"
	| "unknown"
	| "auto";

interface StructureInfo {
	structure: I18nStructure;
	confidence: number; // 0-1
	sourceLanguage: string | null;
	i18nPath: string | null;
}

/**
 * Common language codes to detect
 */
const COMMON_LANG_CODES = [
	"en",
	"pt",
	"pt-BR",
	"es",
	"fr",
	"de",
	"it",
	"ja",
	"ko",
	"zh",
	"zh-CN",
	"zh-TW",
	"ru",
	"ar",
	"hi",
	"tr",
	"pl",
	"nl",
	"sv",
	"cs",
	"hu",
	"ro",
	"vi",
	"th",
	"id",
	"ms",
	"uk",
	"el",
	"he",
	"da",
	"fi",
	"no",
	"sk",
	"sl",
	"bg",
];

/**
 * Detect i18n structure by scanning project directories
 */
export function detectStructure(cwd: string = process.cwd()): StructureInfo {
	// Common i18n directory names
	const commonDirs = [
		"locales",
		"i18n",
		"lang",
		"languages",
		"translations",
		"messages",
		"intl",
	];

	// Check each common directory location
	for (const dirName of commonDirs) {
		const dirPath = join(cwd, dirName);

		if (!existsSync(dirPath)) continue;

		const stat = statSync(dirPath);
		if (!stat.isDirectory()) continue;

		const entries = readdirSync(dirPath, { withFileTypes: true });

		// Pattern 1: Directory per language (locales/en/, locales/pt-BR/)
		const subdirs = entries.filter((e) => e.isDirectory());
		const langDirs = subdirs.filter((d) =>
			COMMON_LANG_CODES.some(
				(code) =>
					d.name === code || d.name.toLowerCase() === code.toLowerCase(),
			),
		);

		if (langDirs.length >= 2) {
			return {
				structure: "directory",
				confidence: 0.9,
				sourceLanguage: langDirs[0]?.name || null,
				i18nPath: dirPath,
			};
		}

		// Pattern 2: File per language (i18n/en.json, i18n/pt-BR.json)
		const files = entries.filter((e) => e.isFile());
		const langFiles = files.filter((f) => {
			const name = f.name.replace(/\.(json|yaml|yml|po|mo)$/i, "");
			return COMMON_LANG_CODES.some(
				(code) => name === code || name.toLowerCase() === code.toLowerCase(),
			);
		});

		if (langFiles.length >= 2) {
			return {
				structure: "file",
				confidence: 0.85,
				sourceLanguage:
					langFiles[0]?.name.replace(/\.(json|yaml|yml|po|mo)$/i, "") || null,
				i18nPath: dirPath,
			};
		}
	}

	// Pattern 3: Suffix pattern (strings.en.json, strings.pt-BR.json)
	// Check in root and common locations
	const searchPaths = [
		cwd,
		join(cwd, "src"),
		join(cwd, "public"),
		join(cwd, "assets"),
	];

	for (const searchPath of searchPaths) {
		if (!existsSync(searchPath)) continue;

		const entries = readdirSync(searchPath, { withFileTypes: true });
		const files = entries.filter(
			(e) => e.isFile() && /\.(json|yaml|yml)$/i.test(e.name),
		);

		// Look for files with language suffixes
		const suffixPattern = new RegExp(
			`\\.(${COMMON_LANG_CODES.join("|")})\\.(json|yaml|yml)$`,
			"i",
		);

		const suffixFiles = files.filter((f) => suffixPattern.test(f.name));

		if (suffixFiles.length >= 2 && suffixFiles[0]) {
			// Extract base name (e.g., "messages" from "messages.en.json")
			const _baseName = suffixFiles[0].name.replace(suffixPattern, "");

			return {
				structure: "suffix",
				confidence: 0.8,
				sourceLanguage: null, // Need to detect from files
				i18nPath: searchPath,
			};
		}
	}

	return {
		structure: "unknown",
		confidence: 0,
		sourceLanguage: null,
		i18nPath: null,
	};
}

/**
 * Detect source language by finding which language has most content
 */
export function detectSourceLanguage(
	i18nPath: string,
	structure: I18nStructure,
): string | null {
	if (!existsSync(i18nPath)) return null;

	try {
		const entries = readdirSync(i18nPath, { withFileTypes: true });

		if (structure === "directory") {
			// Count files in each language directory
			const langDirs = entries.filter((e) => e.isDirectory());

			let maxFiles = 0;
			let sourceLang: string | null = null;

			for (const dir of langDirs) {
				const dirPath = join(i18nPath, dir.name);
				const files = readdirSync(dirPath).filter((f) =>
					/\.(json|yaml|yml|po)$/i.test(f),
				);

				if (files.length > maxFiles) {
					maxFiles = files.length;
					sourceLang = dir.name;
				}
			}

			return sourceLang;
		}

		if (structure === "file") {
			// Check file sizes
			const langFiles = entries.filter(
				(e) => e.isFile() && /\.(json|yaml|yml|po)$/i.test(e.name),
			);

			let maxSize = 0;
			let sourceLang: string | null = null;

			for (const file of langFiles) {
				const filePath = join(i18nPath, file.name);
				const stat = statSync(filePath);

				if (stat.size > maxSize) {
					maxSize = stat.size;
					sourceLang = file.name.replace(/\.(json|yaml|yml|po)$/i, "");
				}
			}

			return sourceLang;
		}

		if (structure === "suffix") {
			// For suffix pattern, find the most common suffix
			const suffixCounts: Record<string, number> = {};

			for (const entry of entries) {
				if (!entry.isFile()) continue;

				const match = entry.name.match(/\.(\w+)\.(json|yaml|yml)$/i);
				if (match?.[1]) {
					const lang = match[1];
					suffixCounts[lang] = (suffixCounts[lang] || 0) + 1;
				}
			}

			// Return the most common language suffix
			const sorted = Object.entries(suffixCounts).sort((a, b) => b[1] - a[1]);
			return sorted[0]?.[0] || null;
		}
	} catch {
		return null;
	}

	return null;
}

/**
 * Get all translatable files for a language
 */
export function getLanguageFiles(
	i18nPath: string,
	structure: I18nStructure,
	language: string,
): string[] {
	// Resolve path to handle '.' and '..' correctly
	const resolvedPath = resolve(i18nPath);
	if (!existsSync(resolvedPath)) return [];

	const _files: string[] = [];

	try {
		if (structure === "directory") {
			const langDir = join(resolvedPath, language);
			if (!existsSync(langDir)) return [];

			// Recursively get all JSON/YAML/PO files
			const getFilesRecursive = (dir: string): string[] => {
				const result: string[] = [];
				const entries = readdirSync(dir, { withFileTypes: true });

				for (const entry of entries) {
					const fullPath = join(dir, entry.name);

					if (entry.isDirectory()) {
						result.push(...getFilesRecursive(fullPath));
					} else if (/\.(json|yaml|yml|po)$/i.test(entry.name)) {
						result.push(fullPath);
					}
				}

				return result;
			};

			return getFilesRecursive(langDir);
		}

		if (structure === "file") {
			const entries = readdirSync(resolvedPath);
			return entries
				.filter(
					(f) =>
						f.startsWith(`${language}.`) && /\.(json|yaml|yml|po)$/i.test(f),
				)
				.map((f) => join(resolvedPath, f));
		}

		if (structure === "suffix") {
			const entries = readdirSync(resolvedPath);
			return entries
				.filter(
					(f) =>
						f.includes(`.${language}.`) && /\.(json|yaml|yml|po)$/i.test(f),
				)
				.map((f) => join(resolvedPath, f));
		}
	} catch {
		return [];
	}

	return [];
}
