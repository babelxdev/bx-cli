import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// Config structure type (includes "auto" for detection)
export type ConfigStructure = "directory" | "file" | "suffix" | "auto";

// Re-export I18nStructure from structure-detector
export type { I18nStructure } from "../utils/structure-detector.js";

// Configuration schema
const ConfigSchema = z.object({
	apiUrl: z.url().default("https://api.babelx.dev"),
	apiKey: z.string().optional(),
	projectId: z.string().optional(),
	sourceLanguage: z.string().default("en"),
	targetLanguages: z.array(z.string()).default(["pt-BR"]),
	i18nFormat: z.enum(["json", "yaml", "po"]).default("json"),
	i18nPath: z.string().default("./locales"),
	structure: z.enum(["directory", "file", "suffix", "auto"]).default("auto"),
});

export type Config = z.infer<typeof ConfigSchema>;

// BabelX project config schema (.babelx.json)
const BabelXProjectConfigSchema = z.object({
	projectId: z.string().optional(),
	sourceLanguage: z.string().default("en"),
	targetLanguages: z.array(z.string()).default(["pt-BR"]),
	i18nFormat: z.enum(["json", "yaml", "po"]).default("json"),
	i18nPath: z.string().default("./locales"),
	structure: z.enum(["directory", "file", "suffix", "auto"]).default("auto"),
	apiKey: z.string().optional(),
});

export type BabelXProjectConfig = z.infer<typeof BabelXProjectConfigSchema>;

export async function loadConfig(): Promise<Config> {
	const env = {
		apiUrl: process.env.BABELX_API_URL,
		apiKey: process.env.BABELX_API_KEY,
		projectId: process.env.BABELX_PROJECT_ID,
		sourceLanguage: process.env.BABELX_SOURCE_LANGUAGE,
		targetLanguages: process.env.BABELX_TARGET_LANGUAGES?.split(","),
		i18nFormat: process.env.BABELX_I18N_FORMAT,
		i18nPath: process.env.BABELX_I18N_PATH,
	};

	// Load project config if exists
	const projectConfig = await loadProjectConfig();
	if (projectConfig) {
		return ConfigSchema.parse({
			...env,
			...projectConfig,
		});
	}

	return ConfigSchema.parse(env);
}

export async function loadProjectConfig(): Promise<BabelXProjectConfig | null> {
	const configPath = join(process.cwd(), ".babelx.json");

	if (!existsSync(configPath)) {
		return null;
	}

	try {
		const config = await Bun.file(configPath).json();
		return BabelXProjectConfigSchema.parse(config);
	} catch {
		return null;
	}
}

export async function saveProjectConfig(
	config: BabelXProjectConfig,
): Promise<void> {
	const configPath = join(process.cwd(), ".babelx.json");
	await Bun.write(configPath, JSON.stringify(config, null, 2));
}

export function hasProjectConfig(): boolean {
	return existsSync(join(process.cwd(), ".babelx.json"));
}

export async function requireApiKey(): Promise<string> {
	const config = await loadConfig();
	if (!config.apiKey) {
		throw new Error(
			"API key not found. Please run `bx login` or set BABELX_API_KEY environment variable.",
		);
	}
	return config.apiKey;
}
