#!/usr/bin/env node
/**
 * Post-install script for @babelx/cli
 * Downloads the appropriate binary for the current platform
 */

import {
	chmodSync,
	createWriteStream,
	existsSync,
	mkdirSync,
	readFileSync,
} from "node:fs";
import { get } from "node:https";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GITHUB_REPO = "babelxdev/bx-cli";

// ES modules don't have __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getPlatform() {
	const platform = process.platform;
	const arch = process.arch;

	const platformMap = {
		darwin: "darwin",
		linux: "linux",
		win32: "windows",
	};

	const archMap = {
		x64: "x64",
		arm64: "arm64",
	};

	const p = platformMap[platform];
	const a = archMap[arch];

	if (!p || !a) {
		console.error(`❌ Unsupported platform: ${platform} ${arch}`);
		console.error(
			"Supported platforms: darwin-x64, darwin-arm64, linux-x64, linux-arm64, windows-x64",
		);
		process.exit(1);
	}

	return `${p}-${a}`;
}

function getBinaryName() {
	return process.platform === "win32" ? "bx.exe" : "bx";
}

async function downloadBinary(version, platform, destPath) {
	const binaryExt = process.platform === "win32" ? ".exe" : "";
	const url = `https://github.com/${GITHUB_REPO}/releases/download/v${version}/bx-${platform}${binaryExt}`;

	console.log(`📦 Downloading BabelX CLI v${version} for ${platform}...`);
	console.log(`   URL: ${url}`);

	return new Promise((resolve, reject) => {
		const file = createWriteStream(destPath);
		get(url, { followRedirects: true }, (response) => {
			if (response.statusCode === 302 || response.statusCode === 301) {
				// Handle redirect
				get(response.headers.location, (res) => {
					res.pipe(file);
					file.on("finish", () => {
						file.close();
						resolve();
					});
				}).on("error", reject);
			} else if (response.statusCode === 200) {
				response.pipe(file);
				file.on("finish", () => {
					file.close();
					resolve();
				});
			} else {
				reject(
					new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`),
				);
			}
		}).on("error", reject);
	});
}

function makeExecutable(filePath) {
	if (process.platform !== "win32") {
		chmodSync(filePath, 0o755);
	}
}

async function main() {
	try {
		// Get package version
		const packageJson = JSON.parse(
			readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
		);
		const version = packageJson.version;

		const platform = getPlatform();
		const binaryName = getBinaryName();

		// Create vendor directory
		const vendorDir = join(__dirname, "..", "vendor", platform);
		if (!existsSync(vendorDir)) {
			mkdirSync(vendorDir, { recursive: true });
		}

		const binaryPath = join(vendorDir, binaryName);

		// Check if binary already exists
		if (existsSync(binaryPath)) {
			console.log(`✅ BabelX CLI binary already exists for ${platform}`);
			return;
		}

		// Download binary
		await downloadBinary(version, platform, binaryPath);

		// Make executable (Unix only)
		makeExecutable(binaryPath);

		console.log(`✅ BabelX CLI v${version} installed successfully!`);
		console.log(`   Binary: ${binaryPath}`);
	} catch (error) {
		console.error("❌ Failed to install BabelX CLI binary:", error.message);
		console.error("");
		console.error("You can try:");
		console.error("1. Check your internet connection");
		console.error("2. Install manually from GitHub releases:");
		console.error(`   https://github.com/${GITHUB_REPO}/releases`);
		process.exit(1);
	}
}

main();
