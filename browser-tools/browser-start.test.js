import test from "node:test";
import assert from "node:assert/strict";
import { resolveChromeConfig } from "./chrome-config.js";

test("resolveChromeConfig returns macOS app binary and profile path", () => {
	const cfg = resolveChromeConfig("darwin", "/home/taras");
	assert.equal(cfg.binary, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
	assert.equal(cfg.profileDir, "/home/taras/Library/Application Support/Google/Chrome");
});

test("resolveChromeConfig honors explicit linux browser binary", () => {
	const cfg = resolveChromeConfig("linux", "/home/taras", {
		browserBin: "chromium",
		commandExists: (cmd) => cmd === "chromium",
	});
	assert.equal(cfg.binary, "chromium");
	assert.match(cfg.profileDir, /^\/home\/taras\/.config\/(google-chrome|chromium)$/);
});
