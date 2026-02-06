#!/usr/bin/env bun
import { Command } from "commander";
import { cacheCommand } from "./src/commands/cache.js";
import { initCommand } from "./src/commands/init.js";
import { languagesCommand } from "./src/commands/languages.js";
import { lockfileCommand } from "./src/commands/lockfile.js";
import { loginCommand } from "./src/commands/login.js";
import { projectsCommand } from "./src/commands/projects.js";
import { syncCommand } from "./src/commands/sync.js";
import { translateCommand } from "./src/commands/translate.js";

const pkg = await import("./package.json", { with: { type: "json" } });
const version = pkg.default.version;

const program = new Command();

program
	.name("bx")
	.description("BabelX CLI - Translation and i18n management tool")
	.version(version, "-v, --version");

// Register commands
program.addCommand(initCommand);
program.addCommand(loginCommand);
program.addCommand(translateCommand);
program.addCommand(syncCommand);
program.addCommand(languagesCommand);
program.addCommand(projectsCommand);
program.addCommand(cacheCommand);
program.addCommand(lockfileCommand);

program.parse();
