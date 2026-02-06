/**
 * Initialize BabelX in your project with auto-detection
 */

import { Command } from "commander";
import { render } from "ink";
import React from "react";
import {
	type BabelXProjectConfig,
	hasProjectConfig,
	loadProjectConfig,
	saveProjectConfig,
} from "../config/index.js";
import { InitApp } from "../ui/init-app.js";
import { log, spinner } from "../utils/logger.js";
import {
	detectSourceLanguage,
	detectStructure,
} from "../utils/structure-detector.js";

// Check if we're in an interactive TTY environment
function isTTY(): boolean {
	return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

// Check if any explicit configuration options were provided
function hasExplicitOptions(options: {
	structure?: string;
	source?: string;
	targets?: string;
	path?: string;
}): boolean {
	return Boolean(
		options.structure || options.source || options.targets || options.path,
	);
}

export const initCommand = new Command("init")
	.description("Initialize BabelX in your project")
	.option("-y, --yes", "Skip prompts and use auto-detection/defaults")
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

		// If -y/--yes or explicit options provided, use auto mode
		if (options.yes || hasExplicitOptions(options)) {
			return runAutoMode(options);
		}

		// Interactive mode is the default
		// If TTY available, use Ink UI
		if (isTTY()) {
			return new Promise<void>((resolve) => {
				const { waitUntilExit } = render(
					React.createElement(InitApp, {
						onComplete: async (wizardConfig) => {
							const config: BabelXProjectConfig = {
								sourceLanguage: wizardConfig.sourceLang || "en",
								targetLanguages: wizardConfig.targetLangs
									?.split(",")
									.map((l: string) => l.trim()) || ["pt-BR"],
								i18nPath: wizardConfig.i18nPath || "./locales",
								i18nFormat: "json",
								structure: (wizardConfig.structure || "directory") as
									| "directory"
									| "file"
									| "suffix",
							};

							try {
								await saveProjectConfig(config);
								log.success("✅ BabelX initialized!");
								log.info("");
								log.info("Configuration:");
								log.info(`  Source language: ${config.sourceLanguage}`);
								log.info(
									`  Target languages: ${config.targetLanguages?.join(", ")}`,
								);
								log.info(`  Structure: ${config.structure}`);
								log.info(`  Path: ${config.i18nPath}`);
								log.info("");
								log.info("Next steps:");
								log.info("  1. Run `bx login <your-api-key>` to authenticate");
								log.info("  2. Run `bx translate` to translate your files");
								log.info("  3. Run `bx sync` to keep translations updated");
							} catch (error) {
								log.error(
									error instanceof Error
										? error.message
										: "Failed to save configuration",
								);
							}
							resolve();
						},
						onCancel: () => {
							log.info("Setup cancelled.");
							resolve();
						},
					}),
				);

				waitUntilExit().then(() => resolve());
			});
		}

		// No TTY available - use traditional prompts
		return runTraditionalPrompts();
	});

// Auto mode: use auto-detection or provided options
async function runAutoMode(options: {
	yes?: boolean;
	structure?: string;
	source?: string;
	targets?: string;
	path?: string;
}): Promise<void> {
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
		const detectedLang = detectSourceLanguage(
			i18nPath,
			structure as "directory" | "file" | "suffix",
		);
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
		structure: structure as "directory" | "file" | "suffix",
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
}

// Traditional prompts for non-TTY environments
async function runTraditionalPrompts(): Promise<void> {
	const readline = await import("node:readline");
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const ask = (question: string): Promise<string> => {
		return new Promise((resolve) => {
			rl.question(question, (answer) => resolve(answer.trim()));
		});
	};

	try {
		log.info("");
		log.info("BabelX Interactive Setup");
		log.info("");

		// Structure selection
		log.info("Select project structure:");
		log.info("  1. directory (locales/en/common.json)");
		log.info("  2. file (i18n/en.json)");
		log.info("  3. suffix (messages.en.json)");
		const structureChoice = await ask("Enter choice (1-3) [1]: ");
		const structures = ["directory", "file", "suffix"];
		const structure =
			structures[Number.parseInt(structureChoice || "1", 10) - 1] ||
			"directory";

		// Source language
		const sourceLang = await ask("Source language code (e.g., en) [en]: ");

		// Target languages
		const targetLangsInput = await ask(
			"Target languages (comma-separated, e.g., pt-BR,es) [pt-BR]: ",
		);
		const targetLangs = targetLangsInput
			? targetLangsInput.split(",").map((l) => l.trim())
			: ["pt-BR"];

		// Path
		const defaultPath = structure === "directory" ? "./locales" : ".";
		const i18nPath = await ask(`Path to translations [${defaultPath}]: `);

		const config: BabelXProjectConfig = {
			sourceLanguage: sourceLang || "en",
			targetLanguages: targetLangs,
			i18nPath: i18nPath || defaultPath,
			i18nFormat: "json",
			structure: structure as "directory" | "file" | "suffix",
		};

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
	} catch (error) {
		log.error(error instanceof Error ? error.message : "Setup failed");
	} finally {
		rl.close();
	}
}
