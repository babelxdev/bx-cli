import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Command } from "commander";
import { loadConfig, requireApiKey } from "../config/index.js";
import { BabelXApi } from "../services/api.js";
import { log, spinner } from "../utils/logger.js";

export const translateCommand = new Command("translate")
	.description("Translate i18n file(s)")
	.argument("<file|directory>", "File or directory to translate")
	.option("-t, --target <lang>", "Target language code")
	.option("-s, --source <lang>", "Source language code")
	.option("-f, --format <format>", "File format (json, yaml, po)")
	.option("-o, --output <path>", "Output directory")
	.action(async (input, options) => {
		try {
			requireApiKey();
		} catch (error) {
			log.error(error instanceof Error ? error.message : "Unknown error");
			return;
		}

		const config = loadConfig();
		const targetLang = options.target ?? config.targetLanguages[0];
		const sourceLang = options.source ?? config.sourceLanguage;

		log.info(`Translating from ${sourceLang} to ${targetLang}...`);

		const spin = spinner("Translating...");
		spin.start();

		try {
			const api = new BabelXApi();
			const inputPath = join(process.cwd(), input);

			if (!existsSync(inputPath)) {
				spin.fail("File or directory not found");
				log.error(`Path not found: ${inputPath}`);
				return;
			}

			const stats = require("node:fs").statSync(inputPath);
			const isDirectory = stats.isDirectory();

			if (isDirectory) {
				await translateDirectory(
					inputPath,
					targetLang,
					sourceLang,
					api,
					options.output,
				);
			} else {
				await translateFile(
					inputPath,
					targetLang,
					sourceLang,
					api,
					options.output,
				);
			}

			spin.succeed("Translation complete!");
		} catch (error) {
			spin.fail("Translation failed");
			if (error instanceof Error) {
				log.error(error.message);
			}
		}
	});

async function translateFile(
	filePath: string,
	targetLang: string,
	sourceLang: string,
	api: BabelXApi,
	outputPath?: string,
): Promise<void> {
	const content = readFileSync(filePath, "utf-8");
	const ext = filePath.split(".").pop();

	let data: Record<string, string>;

	// Parse based on format
	if (ext === "json") {
		data = JSON.parse(content);
	} else if (ext === "yaml" || ext === "yml") {
		// For now, just handle JSON
		log.warn("YAML format not yet implemented, skipping");
		return;
	} else if (ext === "po") {
		// For now, just handle JSON
		log.warn("PO format not yet implemented, skipping");
		return;
	} else {
		throw new Error(`Unsupported file format: ${ext}`);
	}

	// Prepare items for batch translation
	const items = Object.entries(data).map(([key, text]) => ({ key, text }));

	const spin = spinner(`Translating ${items.length} items...`);
	spin.start();

	// Batch translate
	const translated = await api.translateBatch(items, targetLang, sourceLang);

	// Build result object
	const result: Record<string, string> = {};
	for (const item of translated) {
		result[item.key] = item.translatedText;
	}

	// Determine output path
	let finalOutputPath = outputPath;
	if (!finalOutputPath) {
		// Extract language code from filename and replace with target
		const dir = dirname(filePath);
		const filename = filePath.split("/").pop() ?? "";
		const baseName = filename.replace(/\.[^.]+$/, "");
		finalOutputPath = join(dir, `${baseName}.${targetLang}.json`);
	} else {
		finalOutputPath = join(
			outputPath ?? "",
			filePath.split("/").pop() ?? "output.json",
		);
	}

	// Ensure output directory exists
	mkdirSync(dirname(finalOutputPath), { recursive: true });

	// Write result
	writeFileSync(finalOutputPath, JSON.stringify(result, null, 2), "utf-8");

	spin.succeed(`Translated to ${finalOutputPath}`);
	log.success(`${translated.length} strings translated`);
}

async function translateDirectory(
	dirPath: string,
	targetLang: string,
	sourceLang: string,
	api: BabelXApi,
	outputPath?: string,
): Promise<void> {
	const fs = require("node:fs");
	const files = fs.readdirSync(dirPath);
	const i18nFiles = files.filter((f: string) => f.endsWith(".json"));

	if (i18nFiles.length === 0) {
		log.warn("No i18n files found in directory");
		return;
	}

	log.info(`Found ${i18nFiles.length} i18n files`);

	let translatedCount = 0;
	for (const file of i18nFiles) {
		const filePath = join(dirPath, file);
		await translateFile(filePath, targetLang, sourceLang, api, outputPath);
		translatedCount++;
	}

	log.success(`${translatedCount} files translated`);
}
