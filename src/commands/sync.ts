/**
 * Sync command - detect changes and translate only new/modified strings
 * Like `git pull` for translations
 */

import { existsSync } from "node:fs";
import { Command } from "commander";
import { loadConfig, requireApiKey } from "../config/index.js";
import { BabelXApi } from "../services/api.js";
import {
	getCachedTranslation,
	getCacheStats,
	setCachedTranslation,
} from "../utils/cache.js";
import { flatten, unflatten } from "../utils/flatten.js";
import { log, spinner } from "../utils/logger.js";
import { detectFormat, resolveTargetPath } from "../utils/path-resolver.js";
import {
	getLanguageFiles,
	type I18nStructure,
} from "../utils/structure-detector.js";

export const syncCommand = new Command("sync")
	.description("Sync translations - update only new/changed strings")
	.option("-c, --check", "Check status without making changes")
	.option("--target <lang>", "Specific language to sync (default: all)")
	.option("--force", "Force re-translation of all strings")
	.action(async (options) => {
		try {
			await requireApiKey();
		} catch (error) {
			log.error(error instanceof Error ? error.message : "Unknown error");
			return;
		}

		const config = await loadConfig();

		if (config.structure === "auto") {
			log.error("Structure not detected. Run `bx init` first");
			return;
		}

		const structure = config.structure as I18nStructure;
		const sourceLang = config.sourceLanguage;
		const targetLangs = options.target
			? [options.target]
			: config.targetLanguages;

		log.info(`Syncing translations...`);
		log.info(`Source: ${sourceLang}`);
		log.info(`Targets: ${targetLangs.join(", ")}`);
		log.info(`Structure: ${structure}`);

		// Get source files
		const sourceFiles = getLanguageFiles(
			config.i18nPath,
			structure,
			sourceLang,
		);

		if (sourceFiles.length === 0) {
			log.error(`No source files found in ${config.i18nPath}/${sourceLang}`);
			return;
		}

		// Check mode - just report
		if (options.check) {
			log.info("\n📊 Checking translation status...");
			await checkStatus(
				sourceFiles,
				sourceLang,
				targetLangs,
				structure,
				config.i18nPath,
			);
			return;
		}

		// Sync mode
		const api = await BabelXApi.create();

		for (const targetLang of targetLangs) {
			log.info(`\n🔄 Syncing ${targetLang}...`);
			await syncLanguage(
				sourceFiles,
				sourceLang,
				targetLang,
				structure,
				config.i18nPath,
				api,
				options.force,
			);
		}

		log.success("\n✅ Sync complete!");
	});

/**
 * Check translation status without making changes
 */
async function checkStatus(
	sourceFiles: string[],
	sourceLang: string,
	targetLangs: string[],
	structure: I18nStructure,
	i18nPath: string,
): Promise<void> {
	for (const targetLang of targetLangs) {
		log.info(`\n  ${targetLang}:`);

		let totalNew = 0;
		let totalMissing = 0;
		let totalUpToDate = 0;

		for (const sourcePath of sourceFiles) {
			const targetPath = resolveTargetPath(
				sourcePath,
				sourceLang,
				targetLang,
				structure,
				i18nPath,
			);

			// Read source
			const sourceContent = await Bun.file(sourcePath).text();
			const sourceData = JSON.parse(sourceContent);
			const sourceFlat = flatten(sourceData);

			if (!existsSync(targetPath)) {
				totalMissing += Object.keys(sourceFlat).length;
				log.info(`    ⚠️  Missing: ${targetPath}`);
				continue;
			}

			// Read target
			const targetContent = await Bun.file(targetPath).text();
			const targetData = JSON.parse(targetContent);
			const targetFlat = flatten(targetData);

			// Compare
			const sourceKeys = Object.keys(sourceFlat);
			const targetKeys = Object.keys(targetFlat);

			const newKeys = sourceKeys.filter((k) => !targetKeys.includes(k));
			const extraKeys = targetKeys.filter((k) => !sourceKeys.includes(k));
			const _commonKeys = sourceKeys.filter((k) => targetKeys.includes(k));

			if (newKeys.length > 0) {
				totalNew += newKeys.length;
				log.info(`    ⚠️  ${newKeys.length} new keys in ${sourcePath}`);
			}

			if (extraKeys.length > 0) {
				log.info(`    ℹ️  ${extraKeys.length} unused keys in ${targetPath}`);
			}

			if (newKeys.length === 0) {
				totalUpToDate++;
			}
		}

		log.info(
			`  Summary: ${totalNew} new keys, ${totalMissing} missing files, ${totalUpToDate} up-to-date`,
		);
	}

	// Cache stats
	const cacheStats = await getCacheStats();
	log.info(`\n📦 Cache: ${cacheStats.size} translations`);
	log.info(`   Languages: ${cacheStats.languages.join(", ")}`);
}

/**
 * Sync a specific target language
 */
async function syncLanguage(
	sourceFiles: string[],
	sourceLang: string,
	targetLang: string,
	structure: I18nStructure,
	i18nPath: string,
	api: BabelXApi,
	force = false,
): Promise<void> {
	let totalNew = 0;
	let totalCached = 0;

	for (const sourcePath of sourceFiles) {
		const targetPath = resolveTargetPath(
			sourcePath,
			sourceLang,
			targetLang,
			structure,
			i18nPath,
		);

		// Read source
		const format = detectFormat(sourcePath);
		const sourceContent = await Bun.file(sourcePath).text();
		const sourceData = JSON.parse(sourceContent);
		const sourceFlat = flatten(sourceData);

		// Read or initialize target
		let targetFlat: Record<string, string> = {};
		if (existsSync(targetPath) && !force) {
			try {
				const targetContent = await Bun.file(targetPath).text();
				const targetData = JSON.parse(targetContent);
				targetFlat = flatten(targetData);
			} catch {
				// Ignore parse errors
			}
		}

		// Find new/changed keys
		const keysToTranslate: Array<{ key: string; text: string }> = [];

		for (const [key, text] of Object.entries(sourceFlat)) {
			if (!force && targetFlat[key]) {
				continue; // Already translated
			}

			// Check cache
			if (!force) {
				const cached = await getCachedTranslation(text, sourceLang, targetLang);
				if (cached) {
					targetFlat[key] = cached;
					totalCached++;
					continue;
				}
			}

			keysToTranslate.push({ key, text });
		}

		if (keysToTranslate.length === 0) {
			// Save if we added cached translations
			if (totalCached > 0) {
				await saveFile(targetPath, targetFlat, format);
			}
			continue;
		}

		const spin = spinner(
			`  Translating ${keysToTranslate.length} new items...`,
		);
		spin.start();

		try {
			// Translate in batches
			const BATCH_SIZE = 50;
			for (let i = 0; i < keysToTranslate.length; i += BATCH_SIZE) {
				const batch = keysToTranslate.slice(i, i + BATCH_SIZE);
				const translated = await api.translateBatch(
					batch,
					targetLang,
					sourceLang,
				);

				// Update target and cache
				for (const item of translated) {
					targetFlat[item.key] = item.translatedText;
					const original = batch.find((b) => b.key === item.key);
					if (original) {
						await setCachedTranslation(
							original.text,
							item.translatedText,
							sourceLang,
							targetLang,
						);
					}
				}
			}

			// Save updated target
			await saveFile(targetPath, targetFlat, format);

			totalNew += keysToTranslate.length;
			spin.succeed(`  ✅ ${keysToTranslate.length} items translated`);
		} catch (error) {
			spin.fail(`  ❌ Failed to translate`);
			log.error(error instanceof Error ? error.message : "Unknown error");
		}
	}

	log.info(`  Summary: ${totalNew} translated, ${totalCached} from cache`);
}

/**
 * Save file from flattened data
 */
async function saveFile(
	path: string,
	flattened: Record<string, string>,
	format: string,
): Promise<void> {
	const { mkdirSync } = await import("node:fs");
	const { dirname } = await import("node:path");

	mkdirSync(dirname(path), { recursive: true });

	const nested = unflatten(flattened);

	if (format === "json") {
		await Bun.write(path, JSON.stringify(nested, null, 2));
	}
}
