#!/usr/bin/env bun
import { Command } from "commander";
import { version } from "./package.json" with { type: "json" };
import { initCommand } from "./src/commands/init.js";
import { languagesCommand } from "./src/commands/languages.js";
import { loginCommand } from "./src/commands/login.js";
import { projectsCommand } from "./src/commands/projects.js";
import { translateCommand } from "./src/commands/translate.js";

const program = new Command();

program
	.name("bx")
	.description("BabelX CLI - Translation and i18n management tool")
	.version(version);

// Register commands
program.addCommand(initCommand);
program.addCommand(loginCommand);
program.addCommand(translateCommand);
program.addCommand(languagesCommand);
program.addCommand(projectsCommand);

program.parse();
