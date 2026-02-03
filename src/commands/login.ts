import { Command } from "commander";
import { BabelXApi } from "../services/api.js";
import { log, spinner } from "../utils/logger.js";

export const loginCommand = new Command("login")
	.description("Authenticate with BabelX API")
	.argument("<apiKey>", "Your BabelX API key")
	.option("-u, --url <url>", "API URL", "http://localhost:3001")
	.action(async (apiKey, options) => {
		const spin = spinner("Validating API key...");
		spin.start();

		try {
			const api = new BabelXApi();
			api.setApiKey(apiKey);

			const isValid = await api.validateApiKey();

			if (isValid) {
				spin.succeed("Authentication successful!");

				log.success("API key validated");
				log.info(`API URL: ${options.url}`);

				// Save to .babelx.json if it exists
				const fs = require("node:fs");
				const path = require("node:path");
				const configPath = path.join(process.cwd(), ".babelx.json");

				if (fs.existsSync(configPath)) {
					const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
					config.apiKey = apiKey;
					fs.writeFileSync(
						configPath,
						JSON.stringify(config, null, 2),
						"utf-8",
					);
					log.success("API key saved to .babelx.json");
				} else {
					log.warn("No .babelx.json found in current directory");
					log.info("Run `bx init` to create a project configuration");
					log.info("Or set BABELX_API_KEY environment variable");
				}
			} else {
				spin.fail("Authentication failed");
				log.error("Invalid API key");
			}
		} catch (error) {
			spin.fail("Authentication failed");
			if (error instanceof Error) {
				if (error.message.includes("ECONNREFUSED")) {
					log.error("Could not connect to API server");
					log.info(`Make sure the API is running at: ${options.url}`);
				} else {
					log.error(error.message);
				}
			}
		}
	});
