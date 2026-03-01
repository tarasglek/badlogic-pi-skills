import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function commandExists(cmd) {
	try {
		execSync(`command -v ${cmd}`, { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

export function resolveChromeConfig(
	platform = os.platform(),
	home = process.env.HOME || "",
	overrides = {},
) {
	if (platform === "darwin") {
		return {
			binary: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			profileDir: path.join(home, "Library/Application Support/Google/Chrome"),
		};
	}

	if (platform === "linux") {
		const candidates = [
			overrides.browserBin,
			process.env.BROWSER_BIN,
			"google-chrome-stable",
			"google-chrome",
			"chromium-browser",
			"chromium",
		].filter(Boolean);

		const exists = overrides.commandExists || commandExists;
		let binary = null;
		for (const candidate of candidates) {
			if (exists(candidate)) {
				binary = candidate;
				break;
			}
		}

		if (!binary) {
			throw new Error(
				"Could not find Chrome/Chromium. Install google-chrome or chromium, or set BROWSER_BIN.",
			);
		}

		const chromeProfile = path.join(home, ".config/google-chrome");
		const chromiumProfile = path.join(home, ".config/chromium");
		const profileDir = existsSync(chromeProfile) ? chromeProfile : chromiumProfile;

		return { binary, profileDir };
	}

	throw new Error(`Unsupported platform: ${platform}`);
}
