/**
 * Lockfile management command
 * Similar to lingo.dev's lockfile handling
 */

import { Command } from "commander";
import { clearLockfile, getLockfileStats } from "../utils/lockfile.js";
import { log } from "../utils/logger.js";

export const lockfileCommand = new Command("lockfile")
	.description("Manage translation lockfile (.babelx.lock)")
	.addCommand(
		new Command("stats")
			.description("Show lockfile statistics")
			.action(async () => {
				const stats = await getLockfileStats();
				log.info(`📦 Lockfile entries: ${stats.entries}`);
				if (stats.lastUpdated) {
					log.info(
						`🕒 Last updated: ${new Date(stats.lastUpdated).toLocaleString()}`,
					);
				}
			}),
	)
	.addCommand(
		new Command("clear")
			.description(
				"Clear the lockfile (forces full re-translation on next run)",
			)
			.action(async () => {
				await clearLockfile();
				log.success(
					"✅ Lockfile cleared - next translation will process all keys",
				);
			}),
	);
