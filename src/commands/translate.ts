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
import {
	calculateDelta,
	removeFromLockfile,
	updateLockfile,
} from "../utils/lockfile.js";
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
	.option(
		"--frozen",
		"Validate translations are up-to-date without making changes (CI mode)",
	)
	.option("--force", "Re-translate all keys, bypassing change detection")
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
		if (!config.apiKey) {
			log.error("API key not configured. Run 'bx login' first.");
			return;
		}
		api.setApiKey(config.apiKey);

		for (const targetLang of targetLangs) {
			if (options.frozen) {
				log.info(`\n🔍 Checking ${targetLang}...`);
			} else {
				log.info(`\n🌐 Translating to ${targetLang}...`);
			}

			await translateToLanguage(
				sourceFiles,
				sourceLang,
				targetLang,
				structure,
				config.i18nPath,
				api,
				options.force,
				options.frozen,
			);
		}

		log.success("\n✅ All translations complete!");
	});

/**
 * Translate all files to a specific target language with lockfile support
 */
async function translateToLanguage(
	sourceFiles: string[],
	sourceLang: string,
	targetLang: string,
	structure: I18nStructure,
	i18nPath: string,
	api: BabelXApi,
	force = false,
	frozen = false,
): Promise<void> {
	let totalTranslated = 0;
	let totalCached = 0;
	let totalSkipped = 0;
	const allDeltas: Array<{
		file: string;
		added: string[];
		updated: string[];
		renamed: Array<[string, string]>;
	}> = [];

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
				log.warn(`Skipping ${sourcePath} - ${format} not yet supported`);
				continue;
			}
		} catch (error) {
			log.error(`Failed to parse ${sourcePath}: ${error}`);
			continue;
		}

		// Flatten to get all translation keys
		const flattened = flatten(data);

		// Calculate delta using lockfile
		const delta = await calculateDelta(flattened, process.cwd());
		const hasChanges = delta.hasChanges;

		// In frozen mode, just validate
		if (frozen) {
			if (hasChanges || force) {
				log.error(`  ✗ ${relative(i18nPath, sourcePath)} has pending changes`);
				allDeltas.push({
					file: relative(i18nPath, sourcePath),
					added: delta.added,
					updated: delta.updated,
					renamed: delta.renamed,
				});
			} else {
				log.success(`  ✓ ${relative(i18nPath, sourcePath)} (up to date)`);
			}
			continue;
		}

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

		// Prepare items for translation based on delta
		const itemsToTranslate: TranslationItem[] = [];
		const relativePrefix = getRelativeKeyPrefix(
			sourcePath,
			sourceLang,
			structure,
			i18nPath,
		);

		// Build set of keys that need translation
		const keysToTranslate = new Set(
			force
				? Object.keys(flattened)
				: [
						...delta.added,
						...delta.updated,
						...delta.renamed.map(([, newKey]) => newKey),
					],
		);

		// Log delta summary
		if (delta.hasChanges && !force) {
			const parts: string[] = [];
			if (delta.added.length) parts.push(`${delta.added.length} added`);
			if (delta.updated.length) parts.push(`${delta.updated.length} updated`);
			if (delta.renamed.length) parts.push(`${delta.renamed.length} renamed`);
			log.info(`  ${relative(i18nPath, sourcePath)}: ${parts.join(", ")}`);
		}

		for (const [key, text] of Object.entries(flattened)) {
			// Skip if not in delta (unless forcing)
			if (!keysToTranslate.has(key)) {
				totalSkipped++;
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

		if (itemsToTranslate.length === 0 && !delta.hasChanges) {
			log.success(`  ✓ ${relative(i18nPath, sourcePath)} (up to date)`);
			// Save existing target if it was updated from cache
			if (totalCached > 0 && !existsSync(targetPath)) {
				await saveTargetFile(targetPath, existingTarget, format);
			}
			continue;
		}

		if (itemsToTranslate.length === 0) {
			// Update lockfile even if no API calls needed
			await updateLockfile(flattened, process.cwd());
			log.success(`  ✓ ${relative(i18nPath, sourcePath)} (from cache)`);
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

			// Update lockfile
			await updateLockfile(flattened, process.cwd());

			// Remove deleted keys from lockfile
			if (delta.removed.length > 0) {
				await removeFromLockfile(delta.removed, process.cwd());
			}

			spin.succeed(
				`  ✓ ${relative(i18nPath, sourcePath)} (${itemsToTranslate.length} items)`,
			);
		} catch (error) {
			spin.fail(`  ✗ ${relative(i18nPath, sourcePath)}`);
			log.error(error instanceof Error ? error.message : "Translation failed");
		}
	}

	// In frozen mode, exit with error if there were changes
	if (frozen && allDeltas.length > 0) {
		log.error("\n❌ Frozen check failed - translations are out of date:");
		for (const delta of allDeltas) {
			log.info(`\n  ${delta.file}:`);
			if (delta.added.length) log.info(`    Added: ${delta.added.join(", ")}`);
			if (delta.updated.length)
				log.info(`    Updated: ${delta.updated.join(", ")}`);
			if (delta.renamed.length)
				log.info(
					`    Renamed: ${delta.renamed.map(([old, n]) => `${old} -> ${n}`).join(", ")}`,
				);
		}
		process.exit(1);
	}

	if (!frozen) {
		log.info(
			`  Translated: ${totalTranslated} new, ${totalCached} from cache, ${totalSkipped} skipped`,
		);
	}
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
