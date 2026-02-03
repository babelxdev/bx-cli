import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// Configuration schema
const ConfigSchema = z.object({
	apiUrl: z.url().default("http://localhost:3001"),
	apiKey: z.string().optional(),
	projectId: z.string().optional(),
	sourceLanguage: z.string().default("en"),
	targetLanguages: z.array(z.string()).default(["pt-BR"]),
	i18nFormat: z.enum(["json", "yaml", "po"]).default("json"),
	i18nPath: z.string().default("./locales"),
});

export type Config = z.infer<typeof ConfigSchema>;

// BabelX project config schema (.babelx.json)
const BabelXProjectConfigSchema = z.object({
	projectId: z.string().optional(),
	sourceLanguage: z.string().default("en"),
	targetLanguages: z.array(z.string()).default(["pt-BR"]),
	i18nFormat: z.enum(["json", "yaml", "po"]).default("json"),
	i18nPath: z.string().default("./locales"),
	apiKey: z.string().optional(),
});

export type BabelXProjectConfig = z.infer<typeof BabelXProjectConfigSchema>;

export function loadConfig(): Config {
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
	const projectConfig = loadProjectConfig();
	if (projectConfig) {
		return ConfigSchema.parse({
			...env,
			...projectConfig,
		});
	}

	return ConfigSchema.parse(env);
}

export function loadProjectConfig(): BabelXProjectConfig | null {
	const configPath = join(process.cwd(), ".babelx.json");

	if (!existsSync(configPath)) {
		return null;
	}

	try {
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		return BabelXProjectConfigSchema.parse(config);
	} catch {
		return null;
	}
}

export function saveProjectConfig(config: BabelXProjectConfig): void {
	const configPath = join(process.cwd(), ".babelx.json");
	writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function hasProjectConfig(): boolean {
	return existsSync(join(process.cwd(), ".babelx.json"));
}

export function requireApiKey(): string {
	const config = loadConfig();
	if (!config.apiKey) {
		throw new Error(
			"API key not found. Please run `bx login` or set BABELX_API_KEY environment variable.",
		);
	}
	return config.apiKey;
}
