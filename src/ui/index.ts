/**
 * Enhanced UI module for BabelX CLI
 * Combines Ink React components with fallback to traditional console output
 */

import type { Delta } from "../utils/lockfile.js";

// Re-export all components
export * from "./components.js";
export * from "./init-app.js";
export * from "./login-app.js";
export * from "./translate-app.js";

// Check if we're in an interactive environment
function isInteractive(): boolean {
	return (
		process.stdout.isTTY === true &&
		!process.env.CI &&
		!process.env.BABELX_NO_UI
	);
}

// Types for UI data
interface TranslationInfo {
	file: string;
	targetLang: string;
	delta: Delta;
	items: number;
}

interface TranslationResult {
	file: string;
	targetLang: string;
	status: "success" | "error" | "skipped" | "cached";
	items: number;
	error?: string;
}

// Progress tracking class for batch operations
export class TranslationUI {
	private useInk: boolean;
	private results: TranslationResult[] = [];
	private currentFile?: string;

	constructor() {
		this.useInk = isInteractive();
	}

	showBanner(): void {
		if (this.useInk) {
			// Ink will show banner
		} else {
			console.log("");
			console.log("  BABELX - AI-powered i18n CLI");
			console.log("");
		}
	}

	showHeader(source: string, targets: string[], structure: string): void {
		if (!this.useInk) {
			console.log(`  Source: ${source}`);
			console.log(`  Targets: ${targets.join(", ")}`);
			console.log(`  Structure: ${structure}`);
			console.log("");
		}
	}

	startFile(file: string, _targetLang: string, delta: Delta): void {
		this.currentFile = file;

		if (!this.useInk) {
			const parts: string[] = [];
			if (delta.added.length) parts.push(`${delta.added.length} added`);
			if (delta.updated.length) parts.push(`${delta.updated.length} updated`);
			if (delta.renamed.length) parts.push(`${delta.renamed.length} renamed`);

			if (parts.length > 0) {
				console.log(`  ${file}: ${parts.join(", ")}`);
			}
		}
	}

	updateProgress(_current: number, _total: number): void {
		if (!this.useInk && this.currentFile) {
			// Traditional progress could be shown here
		}
	}

	finishFile(result: TranslationResult): void {
		this.results.push(result);
		this.currentFile = undefined;

		if (!this.useInk) {
			const icon = result.status === "error" ? "✗" : "✓";
			const status =
				result.status === "cached"
					? "(from cache)"
					: result.status === "skipped"
						? "(up to date)"
						: `(${result.items} items)`;

			if (result.status === "error") {
				console.log(`  ${icon} ${result.file} - Error: ${result.error}`);
			} else {
				console.log(`  ${icon} ${result.file} ${status}`);
			}
		}
	}

	showSummary(): void {
		if (!this.useInk) {
			const translated = this.results.filter(
				(r) => r.status === "success",
			).length;
			const cached = this.results.filter((r) => r.status === "cached").length;
			const skipped = this.results.filter((r) => r.status === "skipped").length;
			const failed = this.results.filter((r) => r.status === "error").length;

			console.log("");
			console.log(
				`  Translated: ${translated} new, ${cached} from cache, ${skipped} skipped`,
			);
			if (failed > 0) {
				console.log(`  Failed: ${failed}`);
			}
			console.log("");
		}
	}

	showError(message: string): void {
		if (!this.useInk) {
			console.error(`  ✗ ${message}`);
		}
	}

	showSuccess(message: string): void {
		if (!this.useInk) {
			console.log(`  ✓ ${message}`);
		}
	}

	showInfo(message: string): void {
		if (!this.useInk) {
			console.log(`  ℹ ${message}`);
		}
	}

	getResults(): TranslationResult[] {
		return this.results;
	}
}

// Simple spinner for non-Ink mode
export function createSpinner(text: string) {
	let interval: NodeJS.Timeout | null = null;
	let frame = 0;
	const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

	return {
		start() {
			if (!isInteractive()) {
				console.log(`  ${text}...`);
				return;
			}

			process.stdout.write(`  ${frames[0]} ${text}`);
			interval = setInterval(() => {
				frame = (frame + 1) % frames.length;
				process.stdout.write(`\r  ${frames[frame]} ${text}`);
			}, 80);
		},
		succeed(message?: string) {
			if (interval) {
				clearInterval(interval);
				interval = null;
			}
			const finalMessage = message || text;
			console.log(`\r  ✓ ${finalMessage}`);
		},
		fail(message?: string) {
			if (interval) {
				clearInterval(interval);
				interval = null;
			}
			const finalMessage = message || text;
			console.log(`\r  ✗ ${finalMessage}`);
		},
	};
}

// Re-export components for direct Ink usage
export { isInteractive };
export type { TranslationInfo, TranslationResult };
