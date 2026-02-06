import { Command } from "commander";
import { requireApiKey } from "../config/index.js";
import { BabelXApi } from "../services/api.js";
import { formatTable, log, spinner } from "../utils/logger.js";

export const languagesCommand = new Command("languages")
	.description("List available translation languages")
	.option("--search <query>", "Filter languages by name or code")
	.action(async (options) => {
		try {
			await requireApiKey();
		} catch (error) {
			log.error(error instanceof Error ? error.message : "Unknown error");
			return;
		}

		const spin = spinner("Fetching languages...");
		spin.start();

		try {
			const api = await BabelXApi.create();
			const languages = await api.getLanguages();

			spin.succeed("Languages fetched successfully");

			let filtered = languages;
			if (options.search) {
				const query = options.search.toLowerCase();
				filtered = languages.filter(
					(lang) =>
						lang.name.toLowerCase().includes(query) ||
						lang.code.toLowerCase().includes(query),
				);
			}

			if (filtered.length === 0) {
				log.warn("No languages found matching your search");
				return;
			}

			const rows = filtered.map((lang) => [
				lang.code,
				lang.name,
				lang.nativeName ?? "",
			]);

			formatTable(rows, ["Code", "Name", "Native Name"]);

			log.info(`\nShowing ${filtered.length} of ${languages.length} languages`);
		} catch (error) {
			spin.fail("Failed to fetch languages");
			if (error instanceof Error) {
				if (error.message.includes("ECONNREFUSED")) {
					log.error("Could not connect to API server");
				} else {
					log.error(error.message);
				}
			}
		}
	});
