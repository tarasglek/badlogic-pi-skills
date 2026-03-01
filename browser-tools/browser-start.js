#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { resolveChromeConfig } from "./chrome-config.js";

function shellQuote(value) {
	return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

export async function main(argv = process.argv.slice(2)) {
	let useProfile = false;
	let browserBin;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--profile") {
			useProfile = true;
			continue;
		}
		if (arg === "--browser") {
			browserBin = argv[i + 1];
			i++;
			continue;
		}
		console.log("Usage: browser-start.js [--profile] [--browser <binary>]");
		console.log("\nOptions:");
		console.log("  --profile           Copy your default Chrome profile (cookies, logins)");
		console.log("  --browser <binary>  Browser binary name/path (e.g. chromium)");
		process.exit(1);
	}

	const SCRAPING_DIR = `${process.env.HOME}/.cache/browser-tools`;

	// Check if already running on :9222
	try {
		const browser = await puppeteer.connect({
			browserURL: "http://localhost:9222",
			defaultViewport: null,
		});
		await browser.disconnect();
		console.log("✓ Chrome already running on :9222");
		process.exit(0);
	} catch {}

	const config = resolveChromeConfig(undefined, undefined, { browserBin });

	// Setup profile directory
	execSync(`mkdir -p ${shellQuote(SCRAPING_DIR)}`, { stdio: "ignore" });

	// Remove SingletonLock to allow new instance
	try {
		execSync(
			`rm -f ${shellQuote(path.join(SCRAPING_DIR, "SingletonLock"))} ${shellQuote(path.join(SCRAPING_DIR, "SingletonSocket"))} ${shellQuote(path.join(SCRAPING_DIR, "SingletonCookie"))}`,
			{ stdio: "ignore" },
		);
	} catch {}

	if (useProfile) {
		console.log("Syncing profile...");
		execSync(
			`rsync -a --delete \
				--exclude='SingletonLock' \
				--exclude='SingletonSocket' \
				--exclude='SingletonCookie' \
				--exclude='*/Sessions/*' \
				--exclude='*/Current Session' \
				--exclude='*/Current Tabs' \
				--exclude='*/Last Session' \
				--exclude='*/Last Tabs' \
				${shellQuote(config.profileDir + "/")} ${shellQuote(SCRAPING_DIR + "/")}`,
			{ stdio: "pipe" },
		);
	}

	// Start Chrome with flags to force new instance
	spawn(
		config.binary,
		[
			"--remote-debugging-port=9222",
			`--user-data-dir=${SCRAPING_DIR}`,
			"--no-first-run",
		],
		{ detached: true, stdio: "ignore" },
	).unref();

	// Wait for Chrome to be ready
	let connected = false;
	for (let i = 0; i < 30; i++) {
		try {
			const browser = await puppeteer.connect({
				browserURL: "http://localhost:9222",
				defaultViewport: null,
			});
			await browser.disconnect();
			connected = true;
			break;
		} catch {
			await new Promise((r) => setTimeout(r, 500));
		}
	}

	if (!connected) {
		console.error("✗ Failed to connect to Chrome");
		process.exit(1);
	}

	console.log(`✓ Chrome started on :9222${useProfile ? " with your profile" : ""}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	await main();
}
