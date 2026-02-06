/**
 * Initialize BabelX in your project with auto-detection
 */

import { Command } from "commander";
import {
	type BabelXProjectConfig,
	hasProjectConfig,
	loadProjectConfig,
	saveProjectConfig,
} from "../config/index.js";
import { log, spinner } from "../utils/logger.js";
import {
	detectSourceLanguage,
	detectStructure,
} from "../utils/structure-detector.js";

export const initCommand = new Command("init")
	.description("Initialize BabelX in your project")
	.option("-y, --yes", "Skip prompts and use defaults/auto-detection")
	.option("--structure <type>", "i18n structure: directory, file, suffix")
	.option("--source <lang>", "Source language")
	.option("--targets <langs>", "Target languages (comma-separated)")
	.option("--path <path>", "Path to i18n files")
	.action(async (options) => {
		// Check if already initialized
		if (hasProjectConfig()) {
			const existing = await loadProjectConfig();
			log.warn("Project already initialized!");
			log.info(`Current config: ${JSON.stringify(existing, null, 2)}`);

			if (!options.yes) {
				log.info(
					"Use --yes to overwrite or delete .babelx.json to reinitialize",
				);
				return;
			}
		}

		const spin = spinner("Analyzing project...");
		spin.start();

		// Auto-detect or use provided values
		let structure = options.structure;
		let sourceLang = options.source;
		const targetLangs = options.targets
			?.split(",")
			.map((l: string) => l.trim()) || ["pt-BR"];
		// Default path based on structure or use provided
		let i18nPath = options.path;
		if (!i18nPath) {
			// If structure is explicitly file or suffix, use current directory
			i18nPath =
				structure === "file" || structure === "suffix" ? "." : "./locales";
		}

		// Auto-detect structure if not provided
		if (!structure) {
			const detected = detectStructure(process.cwd());

			if (detected.structure !== "unknown") {
				structure = detected.structure;
				i18nPath = detected.i18nPath || i18nPath;

				// Try to detect source language
				if (!sourceLang && detected.sourceLanguage) {
					sourceLang = detected.sourceLanguage;
				}

				spin.succeed(`Detected ${structure} structure`);
			} else {
				spin.warn("Could not auto-detect structure");
				structure = "directory"; // Default
			}
		} else {
			spin.succeed(`Using ${structure} structure`);
		}

		// Set default path based on structure if not provided
		if (!i18nPath) {
			i18nPath = structure === "directory" ? "./locales" : ".";
		}
		if (!sourceLang) {
			const detectedLang = detectSourceLanguage(i18nPath, structure);
			if (detectedLang) {
				sourceLang = detectedLang;
			}
		}

		// Fallback defaults
		sourceLang = sourceLang || "en";

		// Make i18nPath relative to current directory
		const relativeI18nPath = i18nPath.startsWith(process.cwd())
			? i18nPath.replace(process.cwd(), "").replace(/^[/\\]/, "")
			: i18nPath;

		// Build config
		const config: BabelXProjectConfig = {
			sourceLanguage: sourceLang,
			targetLanguages: targetLangs,
			i18nPath: relativeI18nPath,
			i18nFormat: "json",
			structure: structure,
		};

		// Save config
		try {
			await saveProjectConfig(config);

			log.success("✅ BabelX initialized!");
			log.info("");
			log.info("Configuration:");
			log.info(`  Source language: ${config.sourceLanguage}`);
			log.info(`  Target languages: ${config.targetLanguages?.join(", ")}`);
			log.info(`  Structure: ${config.structure}`);
			log.info(`  Path: ${config.i18nPath}`);
			log.info("");
			log.info("Next steps:");
			log.info("  1. Run `bx login <your-api-key>` to authenticate");
			log.info("  2. Run `bx translate` to translate your files");
			log.info("  3. Run `bx sync` to keep translations updated");
		} catch (error) {
			spin.fail("Failed to save configuration");
			log.error(error instanceof Error ? error.message : "Unknown error");
		}
	});
