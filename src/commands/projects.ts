import { existsSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { requireApiKey } from "../config/index.js";
import { BabelXApi } from "../services/api.js";
import { formatTable, log, spinner } from "../utils/logger.js";

export const projectsCommand = new Command("projects").description(
	"Manage BabelX projects",
);

projectsCommand
	.command("list")
	.description("List all projects")
	.action(async () => {
		try {
			await requireApiKey();
		} catch (error) {
			log.error(error instanceof Error ? error.message : "Unknown error");
			return;
		}

		const spin = spinner("Fetching projects...");
		spin.start();

		try {
			const api = await BabelXApi.create();
			const projects = await api.getProjects();

			spin.succeed("Projects fetched successfully");

			if (projects.length === 0) {
				log.warn("No projects found");
				log.info("Create a new project with `bx projects create <name>`");
				return;
			}

			const rows = projects.map((p) => [p.id, p.name]);
			formatTable(rows, ["ID", "Name"]);

			log.info(`\nShowing ${projects.length} project(s)`);
		} catch (error) {
			spin.fail("Failed to fetch projects");
			if (error instanceof Error) {
				if (error.message.includes("ECONNREFUSED")) {
					log.error("Could not connect to API server");
				} else {
					log.error(error.message);
				}
			}
		}
	});

projectsCommand
	.command("create")
	.description("Create a new project")
	.argument("<name>", "Project name")
	.option("-s, --source <lang>", "Source language", "en")
	.option("-t, --target <langs>", "Target languages (comma-separated)", "pt-BR")
	.action(async (name, options) => {
		try {
			await requireApiKey();
		} catch (error) {
			log.error(error instanceof Error ? error.message : "Unknown error");
			return;
		}

		const targetLanguages = options.target
			.split(",")
			.map((l: string) => l.trim());

		const spin = spinner(`Creating project "${name}"...`);
		spin.start();

		try {
			const api = await BabelXApi.create();
			const project = await api.createProject(
				name,
				options.source,
				targetLanguages,
			);

			spin.succeed("Project created successfully!");

			log.success(`Project ID: ${project.id}`);
			log.success(`Project Name: ${project.name}`);
			log.info(`Source Language: ${options.source}`);
			log.info(`Target Languages: ${targetLanguages.join(", ")}`);

			// Update .babelx.json if exists
			const configPath = join(process.cwd(), ".babelx.json");

			if (existsSync(configPath)) {
				const config = await Bun.file(configPath).json();
				config.projectId = project.id;
				config.sourceLanguage = options.source;
				config.targetLanguages = targetLanguages;
				await Bun.write(configPath, JSON.stringify(config, null, 2));
				log.success("Project configuration saved to .babelx.json");
			}
		} catch (error) {
			spin.fail("Failed to create project");
			if (error instanceof Error) {
				log.error(error.message);
			}
		}
	});

projectsCommand
	.command("delete")
	.description("Delete a project")
	.argument("<projectId>", "Project ID")
	.option("-y, --yes", "Skip confirmation")
	.action(async (projectId, options) => {
		try {
			await requireApiKey();
		} catch (error) {
			log.error(error instanceof Error ? error.message : "Unknown error");
			return;
		}

		if (!options.yes) {
			log.warn(`This will permanently delete project ${projectId}`);
			// In real implementation, prompt for confirmation here
		}

		const spin = spinner(`Deleting project ${projectId}...`);
		spin.start();

		try {
			const api = await BabelXApi.create();
			await api.deleteProject(projectId);

			spin.succeed("Project deleted successfully");
			log.success(`Project ${projectId} has been deleted`);
		} catch (error) {
			spin.fail("Failed to delete project");
			if (error instanceof Error) {
				log.error(error.message);
			}
		}
	});
