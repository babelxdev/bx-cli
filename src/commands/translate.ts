/**
 * Translate command - supports 3 i18n structures:
 * - directory: locales/en/common.json → locales/pt-BR/common.json
 * - file: i18n/en.json → i18n/pt-BR.json
 * - suffix: messages.en.json → messages.pt-BR.json
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, relative } from "node:path";
import { Command } from "commander";
import {
	type ConfigStructure,
	loadConfig,
	requireApiKey,
} from "../config/index.js";
import { BabelXApi } from "../services/api.js";
import { getCachedTranslation, setCachedTranslation } from "../utils/cache.js";
import { type FlattenedObject, flatten, unflatten } from "../utils/flatten.js";
import { log, spinner } from "../utils/logger.js";
import {
	detectFormat,
	getRelativeKeyPrefix,
	resolveTargetPath,
} from "../utils/path-resolver.js";
import {
	detectStructure,
	getLanguageFiles,
	type I18nStructure,
} from "../utils/structure-detector.js";

interface TranslationItem {
	key: string;
	text: string;
	file: string;
}

export const translateCommand = new Command("translate")
	.description("Translate i18n files using AI")
	.option("-s, --source <lang>", "Source language (default: from config)")
	.option(
		"-t, --target <lang>",
		"Target language(s), comma-separated (default: from config)",
	)
	.option("--structure <type>", "i18n structure: directory, file, suffix, auto")
	.option("--dry-run", "Show what would be translated without making changes")
	.option("--force", "Re-translate even if already translated (ignore cache)")
	.action(async (options) => {
		const config = await loadConfig();

		// Skip API key check for dry-run mode
		if (!options.dryRun) {
			try {
				await requireApiKey();
			} catch (error) {
				log.error(error instanceof Error ? error.message : "Unknown error");
				return;
			}
		}

		// Determine structure
		const rawStructure: ConfigStructure = options.structure || config.structure;
		let structure: I18nStructure;
		if (rawStructure === "auto") {
			const detected = detectStructure(process.cwd());
			structure = detected.structure;

			if (structure === "unknown") {
				log.error(
					"Could not detect i18n structure. Please specify with --structure",
				);
				log.info("Valid options: directory, file, suffix");
				return;
			}

			log.info(
				`Detected structure: ${structure} (confidence: ${detected.confidence})`,
			);
		} else {
			structure = rawStructure;
		}

		// Determine source language
		const sourceLang = options.source || config.sourceLanguage;

		// Determine target languages
		const targetLangs = options.target
			? options.target.split(",").map((l: string) => l.trim())
			: config.targetLanguages;

		log.info(`Source: ${sourceLang}`);
		log.info(`Targets: ${targetLangs.join(", ")}`);
		log.info(`Structure: ${structure}`);
		log.info(`Path: ${config.i18nPath}`);

		const spin = spinner("Scanning files...");
		spin.start();

		// Get all source files
		const sourceFiles = getLanguageFiles(
			config.i18nPath,
			structure,
			sourceLang,
		);

		if (sourceFiles.length === 0) {
			spin.fail("No source files found");
			log.error(
				`Check that ${config.i18nPath}/${sourceLang} exists and contains translation files`,
			);
			return;
		}

		spin.succeed(`Found ${sourceFiles.length} source files`);

		// Dry run mode
		if (options.dryRun) {
			log.info("\n📋 Dry run - files that would be translated:");
			for (const targetLang of targetLangs) {
				log.info(`\n  → ${targetLang}:`);
				for (const sourcePath of sourceFiles) {
					const targetPath = resolveTargetPath(
						sourcePath,
						sourceLang,
						targetLang,
						structure,
						config.i18nPath,
					);
					const relativeSource = relative(process.cwd(), sourcePath);
					const relativeTarget = relative(process.cwd(), targetPath);
					log.info(`    ${relativeSource} → ${relativeTarget}`);
				}
			}
			return;
		}

		// Process each target language
		const api = await BabelXApi.create();
		api.setApiKey(config.apiKey!);

		for (const targetLang of targetLangs) {
			log.info(`\n🌐 Translating to ${targetLang}...`);

			await translateToLanguage(
				sourceFiles,
				sourceLang,
				targetLang,
				structure,
				config.i18nPath,
				api,
				options.force,
			);
		}

		log.success("\n✅ All translations complete!");
	});

/**
 * Translate all files to a specific target language
 */
async function translateToLanguage(
	sourceFiles: string[],
	sourceLang: string,
	targetLang: string,
	structure: I18nStructure,
	i18nPath: string,
	api: BabelXApi,
	force = false,
): Promise<void> {
	let totalTranslated = 0;
	let totalCached = 0;

	for (const sourcePath of sourceFiles) {
		// Determine target path
		const targetPath = resolveTargetPath(
			sourcePath,
			sourceLang,
			targetLang,
			structure,
			i18nPath,
		);

		// Read source file
		const format = detectFormat(sourcePath);
		const content = await Bun.file(sourcePath).text();

		let data: unknown;
		try {
			if (format === "json") {
				data = JSON.parse(content);
			} else {
				// TODO: Add YAML/PO parsers
				log.warn(`Skipping ${sourcePath} - ${format} not yet supported`);
				continue;
			}
		} catch (error) {
			log.error(`Failed to parse ${sourcePath}: ${error}`);
			continue;
		}

		// Flatten to get all translation keys
		const flattened = flatten(data);

		// Check if target exists and load it
		let existingTarget: FlattenedObject = {};
		if (existsSync(targetPath) && !force) {
			try {
				const targetContent = await Bun.file(targetPath).text();
				const targetData = JSON.parse(targetContent);
				existingTarget = flatten(targetData);
				log.debug(`Loaded existing translations from ${targetPath}`);
			} catch {
				// Target exists but couldn't parse, ignore
			}
		}

		// Prepare items for translation
		const itemsToTranslate: TranslationItem[] = [];
		const relativePrefix = getRelativeKeyPrefix(
			sourcePath,
			sourceLang,
			structure,
			i18nPath,
		);

		for (const [key, text] of Object.entries(flattened)) {
			// Skip if already exists in target and not forcing
			if (!force && existingTarget[key]) {
				continue;
			}

			// Check cache
			if (!force) {
				const cached = await getCachedTranslation(text, sourceLang, targetLang);
				if (cached) {
					existingTarget[key] = cached;
					totalCached++;
					continue;
				}
			}

			itemsToTranslate.push({
				key,
				text,
				file: relativePrefix,
			});
		}

		if (itemsToTranslate.length === 0) {
			log.success(`  ✓ ${relative(i18nPath, sourcePath)} (up to date)`);
			// Save existing target if it was updated from cache
			if (totalCached > 0 && !existsSync(targetPath)) {
				await saveTargetFile(targetPath, existingTarget, format);
			}
			continue;
		}

		// Translate in batches
		const spin = spinner(
			`  Translating ${relative(i18nPath, sourcePath)} (${itemsToTranslate.length} items)...`,
		);
		spin.start();

		try {
			// Process in batches of 50
			const BATCH_SIZE = 50;
			for (let i = 0; i < itemsToTranslate.length; i += BATCH_SIZE) {
				const batch = itemsToTranslate.slice(i, i + BATCH_SIZE);

				const translated = await api.translateBatch(
					batch.map((item) => ({ key: item.key, text: item.text })),
					targetLang,
					sourceLang,
				);

				// Merge results
				for (const item of translated) {
					existingTarget[item.key] = item.translatedText;

					// Update cache
					const originalItem = batch.find((b) => b.key === item.key);
					if (originalItem) {
						await setCachedTranslation(
							originalItem.text,
							item.translatedText,
							sourceLang,
							targetLang,
						);
					}
				}

				totalTranslated += translated.length;
			}

			// Save target file
			await saveTargetFile(targetPath, existingTarget, format);

			spin.succeed(
				`  ✓ ${relative(i18nPath, sourcePath)} (${itemsToTranslate.length} items)`,
			);
		} catch (error) {
			spin.fail(`  ✗ ${relative(i18nPath, sourcePath)}`);
			log.error(error instanceof Error ? error.message : "Translation failed");
		}
	}

	log.info(`  Translated: ${totalTranslated} new, ${totalCached} from cache`);
}

/**
 * Save translated content to file
 */
async function saveTargetFile(
	path: string,
	flattened: FlattenedObject,
	format: string,
): Promise<void> {
	// Ensure directory exists
	mkdirSync(dirname(path), { recursive: true });

	// Unflatten and save
	const nested = unflatten(flattened);

	if (format === "json") {
		await Bun.write(path, JSON.stringify(nested, null, 2));
	} else {
		throw new Error(`Format ${format} not yet supported for writing`);
	}
}
