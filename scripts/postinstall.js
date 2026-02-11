#!/usr/bin/env node
/**
 * Post-install script for @babelx/cli (optional)
 * Pre-downloads the binary during installation (if allowed)
 * If this fails, the CLI will download lazily on first run
 */

import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { get } from "node:https";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const GITHUB_REPO = "babelxdev/bx-cli";

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

	if (!p || !a) return null;
	return `${p}-${a}`;
}

function getBinaryName() {
	return process.platform === "win32" ? "bx.exe" : "bx";
}

async function downloadBinary(version, platform, destPath) {
	const binaryExt = process.platform === "win32" ? ".exe" : "";
	const url = `https://github.com/${GITHUB_REPO}/releases/download/v${version}/bx-${platform}${binaryExt}`;

	return new Promise((resolve, reject) => {
		const file = createWriteStream(destPath);
		get(url, { followRedirects: true }, (response) => {
			if (response.statusCode === 302 || response.statusCode === 301) {
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
				reject(new Error(`HTTP ${response.statusCode}`));
			}
		}).on("error", reject);
	});
}

async function main() {
	// Skip if CI, disabled, or not interactive
	if (process.env.CI || process.env.SKIP_BABELX_BINARY) {
		return;
	}

	try {
		const platform = getPlatform();
		if (!platform) return;

		const { readFileSync } = await import("node:fs");
		const packageJson = JSON.parse(
			readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
		);
		const version = packageJson.version;
		const binaryName = getBinaryName();
		const vendorDir = join(__dirname, "..", "vendor", platform);
		const binaryPath = join(vendorDir, binaryName);

		if (existsSync(binaryPath)) return;

		if (!existsSync(vendorDir)) {
			mkdirSync(vendorDir, { recursive: true });
		}

		await downloadBinary(version, platform, binaryPath);

		if (process.platform !== "win32") {
			const { chmodSync } = await import("node:fs");
			chmodSync(binaryPath, 0o755);
		}

		console.log(`✅ BabelX CLI binary pre-downloaded for ${platform}`);
	} catch {
		// Silent fail - CLI will download on first run
	}
}

main();
