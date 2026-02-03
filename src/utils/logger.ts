import chalk from "chalk";
import ora, { type Ora } from "ora";

export const log = {
	success: (message: string) => console.log(chalk.green(`✓ ${message}`)),
	error: (message: string) => console.error(chalk.red(`✗ ${message}`)),
	warn: (message: string) => console.warn(chalk.yellow(`⚠ ${message}`)),
	info: (message: string) => console.log(chalk.blue(`ℹ ${message}`)),
	debug: (message: string) => {
		if (process.env.DEBUG === "true") {
			console.log(chalk.gray(`  ${message}`));
		}
	},
};

export function spinner(text: string): Ora {
	return ora({ text, color: "cyan" });
}

export function formatTable(rows: string[][], headers: string[]): void {
	const maxWidths = headers.map((header, index) => {
		const columnValues = rows.map((row) => row[index] ?? "");
		columnValues.push(header);
		return Math.max(...columnValues.map((val) => val.length));
	});

	const formatRow = (row: string[]) => {
		return row
			.map((cell, index) => cell?.padEnd(maxWidths[index] ?? 0))
			.join("  ")
			.trimEnd();
	};

	console.log(chalk.bold(formatRow(headers)));
	console.log(maxWidths.map((width) => "─".repeat(width)).join("  "));
	for (const row of rows) {
		console.log(formatRow(row));
	}
}
