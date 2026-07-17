#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env --node-modules-dir=none

import { fetchPage } from "./web_content.ts";

const url = Deno.args[0];

if (!url) {
  console.log("Usage: content.ts <url>");
  console.log("\nExtracts readable content from a webpage as markdown.");
  console.log("\nExamples:");
  console.log("  content.ts https://example.com/article");
  console.log(
    "  content.ts https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html",
  );
  Deno.exit(1);
}

try {
  const extracted = await fetchPage(url);
  if (extracted.title) console.log(`# ${extracted.title}\n`);

  if (!extracted.content) {
    console.error("Could not extract readable content from this page.");
    Deno.exit(1);
  }

  console.log(extracted.content);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.startsWith("HTTP ") ? message : `Error: ${message}`);
  Deno.exit(1);
}
