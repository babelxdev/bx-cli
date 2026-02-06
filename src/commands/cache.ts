import { Command } from "commander";
import { clearCache, getCacheStats } from "../utils/cache.js";

export const cacheCommand = new Command("cache")
	.description("Manage translation cache")
	.addCommand(
		new Command("clear")
			.description("Clear all cached translations")
			.action(async () => {
				await clearCache();
				console.log("✅ Cache cleared");
			}),
	)
	.addCommand(
		new Command("stats")
			.description("Show cache statistics")
			.action(async () => {
				const stats = await getCacheStats();
				console.log(`📦 Cache entries: ${stats.size}`);
				console.log(`🌐 Language pairs: ${stats.languages.join(", ")}`);
			}),
	);
