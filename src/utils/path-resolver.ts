/**
 * Path resolution for different i18n structures
 * Handles: directory, file, suffix
 */

import { basename, dirname, extname, join, relative } from "node:path";
import type { I18nStructure } from "./structure-detector.js";

export interface FileMapping {
	sourcePath: string;
	targetPath: string;
	relativePath: string; // Path relative to language folder
	format: "json" | "yaml" | "yml" | "po";
}

/**
 * Resolve source → target paths for each structure type
 */
export function resolveTargetPath(
	sourcePath: string,
	sourceLang: string,
	targetLang: string,
	structure: I18nStructure,
	i18nPath: string,
): string {
	switch (structure) {
		case "directory":
			return resolveDirectoryPath(sourcePath, sourceLang, targetLang, i18nPath);

		case "file":
			return resolveFilePath(sourcePath, sourceLang, targetLang, i18nPath);

		case "suffix":
			return resolveSuffixPath(sourcePath, sourceLang, targetLang);

		default:
			throw new Error(`Unknown structure: ${structure}`);
	}
}

/**
 * Structure: directory
 * locales/en/common.json → locales/pt-BR/common.json
 * locales/en/nested/buttons.json → locales/pt-BR/nested/buttons.json
 */
function resolveDirectoryPath(
	sourcePath: string,
	sourceLang: string,
	targetLang: string,
	i18nPath: string,
): string {
	// Get relative path from source language directory
	const sourceDir = join(i18nPath, sourceLang);
	const relativeFile = relative(sourceDir, sourcePath);

	// Build target path
	return join(i18nPath, targetLang, relativeFile);
}

/**
 * Structure: file
 * i18n/en.json → i18n/pt-BR.json
 * i18n/en-US.json → i18n/pt-BR.json
 */
function resolveFilePath(
	sourcePath: string,
	_sourceLang: string,
	targetLang: string,
	_i18nPath: string,
): string {
	const ext = extname(sourcePath);
	const dir = dirname(sourcePath);

	return join(dir, `${targetLang}${ext}`);
}

/**
 * Structure: suffix
 * messages.en.json → messages.pt-BR.json
 * strings.en.yaml → strings.pt-BR.yaml
 */
function resolveSuffixPath(
	sourcePath: string,
	sourceLang: string,
	targetLang: string,
): string {
	const dir = dirname(sourcePath);
	const ext = extname(sourcePath);
	const base = basename(sourcePath, ext);

	// Remove source language suffix if present
	const baseWithoutLang = base.replace(
		new RegExp(`\\.${sourceLang}$`, "i"),
		"",
	);

	// Add target language suffix
	const newBase = `${baseWithoutLang}.${targetLang}`;

	return join(dir, `${newBase}${ext}`);
}

/**
 * Get relative path within language folder (for keys prefix)
 * locales/en/common.json → common
 * locales/en/nested/buttons.json → nested/buttons
 */
export function getRelativeKeyPrefix(
	filePath: string,
	language: string,
	structure: I18nStructure,
	i18nPath: string,
): string {
	if (structure !== "directory") {
		// For file/suffix structures, use filename without ext
		const ext = extname(filePath);
		const base = basename(filePath, ext);

		// Remove language suffix for suffix pattern
		const cleanBase = base.replace(new RegExp(`\\.${language}$`, "i"), "");

		return cleanBase;
	}

	// For directory structure, get path relative to lang folder
	const langDir = join(i18nPath, language);
	const relativePath = relative(langDir, filePath);

	// Remove extension
	const ext = extname(relativePath);
	const withoutExt = relativePath.slice(0, -ext.length);

	return withoutExt.replace(/\\/g, "/");
}

/**
 * Detect file format from extension
 */
export function detectFormat(filePath: string): "json" | "yaml" | "yml" | "po" {
	const ext = extname(filePath).toLowerCase();

	if (ext === ".json") return "json";
	if (ext === ".yaml") return "yaml";
	if (ext === ".yml") return "yml";
	if (ext === ".po") return "po";

	return "json"; // Default
}

/**
 * Build file mappings for all languages
 */
export function buildFileMappings(
	sourceFiles: string[],
	sourceLang: string,
	targetLangs: string[],
	structure: I18nStructure,
	i18nPath: string,
): Record<string, FileMapping[]> {
	const mappings: Record<string, FileMapping[]> = {};

	for (const targetLang of targetLangs) {
		mappings[targetLang] = sourceFiles.map((sourcePath) => ({
			sourcePath,
			targetPath: resolveTargetPath(
				sourcePath,
				sourceLang,
				targetLang,
				structure,
				i18nPath,
			),
			relativePath: getRelativeKeyPrefix(
				sourcePath,
				sourceLang,
				structure,
				i18nPath,
			),
			format: detectFormat(sourcePath),
		}));
	}

	return mappings;
}
