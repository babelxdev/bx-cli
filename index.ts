#!/usr/bin/env bun
import { Command } from "commander";
import { initCommand } from "./src/commands/init.js";
import { languagesCommand } from "./src/commands/languages.js";
import { loginCommand } from "./src/commands/login.js";
import { projectsCommand } from "./src/commands/projects.js";
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
program.addCommand(languagesCommand);
program.addCommand(projectsCommand);

program.parse();
