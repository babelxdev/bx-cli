import { Command } from "commander";
import {
	hasProjectConfig,
	loadProjectConfig,
	saveProjectConfig,
} from "../config/index.js";
import { log, spinner } from "../utils/logger.js";

export const initCommand = new Command("init")
	.description("Initialize BabelX in your project")
	.option("-y, --yes", "Skip confirmation prompts")
	.action(async (options) => {
		if (hasProjectConfig()) {
			const existing = loadProjectConfig();
			if (!options.yes) {
				log.warn(
					`Project already initialized with:
  - Source Language: ${existing?.sourceLanguage}
  - Target Languages: ${existing?.targetLanguages.join(", ")}
  - Format: ${existing?.i18nFormat}
  - Path: ${existing?.i18nPath}

Re-initialize? This will overwrite your existing config.`,
				);
				// In a real implementation, you would prompt for confirmation here
				// For now, we'll just continue
			}
		}

		const spin = spinner("Initializing BabelX project...");
		spin.start();

		try {
			const config = {
				sourceLanguage: "en",
				targetLanguages: ["pt-BR"],
				i18nFormat: "json" as const,
				i18nPath: "./locales",
			};

			saveProjectConfig(config);

			spin.succeed("BabelX project initialized!");

			log.success("Created .babelx.json configuration file");
			log.info(`Default source language: ${config.sourceLanguage}`);
			log.info(
				`Default target languages: ${config.targetLanguages.join(", ")}`,
			);
			log.info(`i18n files will be saved to: ${config.i18nPath}`);
			log.info("\nNext steps:");
			log.info("  1. Run `bx login` to authenticate");
			log.info("  2. Run `bx translate <file>` to translate your i18n files");
		} catch (error) {
			spin.fail("Failed to initialize project");
			log.error(error instanceof Error ? error.message : "Unknown error");
		}
	});
