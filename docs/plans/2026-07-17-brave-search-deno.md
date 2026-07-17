# Brave Search Deno Rewrite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite the Brave Search skill to run directly with Deno while preserving its executable names, CLI behavior, and output.

**Architecture:** Keep `search.js` and `content.js` as thin executable entry points. Put deterministic argument/result handling in `search_core.js` and shared HTML extraction in `web_content.js`; import pinned npm packages through Deno's `npm:` resolver.

**Tech Stack:** Deno JavaScript, Deno test runner, Brave Search API, Mozilla Readability, jsdom, Turndown, turndown-plugin-gfm

---

### Task 1: Search CLI core

**Files:**
- Create: `brave-search/search_core_test.js`
- Create: `brave-search/search_core.js`

**Step 1: Write failing tests**

Test that `parseSearchArgs([])` returns default values, all existing flags are parsed and removed from the query, `-n` remains compatible with existing `parseInt` behavior, and `formatResults()` exactly reproduces current result blocks including optional age/content fields.

**Step 2: Verify RED**

Run: `cd brave-search && deno test search_core_test.js`
Expected: FAIL because `search_core.js` does not exist.

**Step 3: Implement minimally**

Export:

```js
export function parseSearchArgs(args) {
  const remaining = [...args];
  const fetchContent = removeBooleanFlag(remaining, "--content");
  const numResults = removeValueFlag(remaining, "-n", 5, Number.parseInt);
  const country = removeValueFlag(remaining, "--country", "US", (v) => v.toUpperCase());
  const freshness = removeValueFlag(remaining, "--freshness", null, String);
  return { query: remaining.join(" "), fetchContent, numResults, country, freshness };
}

export function formatResults(results) {
  return results.map((result, index) => {
    const lines = [`--- Result ${index + 1} ---`, `Title: ${result.title}`, `Link: ${result.link}`];
    if (result.age) lines.push(`Age: ${result.age}`);
    lines.push(`Snippet: ${result.snippet}`);
    if (result.content) lines.push(`Content:\n${result.content}`);
    return lines.join("\n");
  }).join("\n\n") + "\n";
}
```

Add only the small private flag-removal helpers needed by the tests.

**Step 4: Verify GREEN**

Run: `cd brave-search && deno test search_core_test.js`
Expected: all tests PASS.

**Step 5: Commit**

```bash
git add brave-search/search_core.js brave-search/search_core_test.js
git commit -m "test: characterize Brave Search CLI behavior"
```

### Task 2: Shared content extraction

**Files:**
- Create: `brave-search/web_content_test.js`
- Create: `brave-search/web_content.js`

**Step 1: Write failing tests**

Use inline HTML fixtures to test:

- GFM conversion, ATX headings, fenced code, and empty-link removal
- Readability extraction of an article
- fallback extraction after removing navigation and scripts
- failure text when no useful content exists

Design the API as:

```js
htmlToMarkdown(html)
extractPageHtml(html, url)
fetchPageContent(url, { timeout, maxLength, headers })
```

**Step 2: Verify RED**

Run: `cd brave-search && deno test web_content_test.js`
Expected: FAIL because `web_content.js` does not exist.

**Step 3: Implement minimally**

Use exact pinned imports:

```js
import { Readability } from "npm:@mozilla/readability@0.6.0";
import { JSDOM } from "npm:jsdom@27.0.1";
import TurndownService from "npm:turndown@7.2.2";
import { gfm } from "npm:turndown-plugin-gfm@1.0.2";
```

Preserve current Markdown cleanup, fallback selectors, HTTP status text, timeout handling, and optional truncation.

**Step 4: Verify GREEN**

Run: `cd brave-search && deno test web_content_test.js`
Expected: all tests PASS.

**Step 5: Commit**

```bash
git add brave-search/web_content.js brave-search/web_content_test.js
git commit -m "feat: add Deno content extraction module"
```

### Task 3: Deno entry points

**Files:**
- Modify: `brave-search/search.js`
- Modify: `brave-search/content.js`
- Create: `brave-search/cli_test.js`

**Step 1: Write failing tests**

Spawn both commands with `Deno.Command` and no arguments. Assert exit code 1 and the existing usage text. Read each first line and assert the exact Deno shebang:

```text
#!/usr/bin/env -S deno run --allow-net --allow-env
```

for search and:

```text
#!/usr/bin/env -S deno run --allow-net
```

for content.

**Step 2: Verify RED**

Run: `cd brave-search && deno test --allow-read --allow-run cli_test.js`
Expected: FAIL because entry points still use Node shebangs/runtime globals.

**Step 3: Rewrite entry points**

- Replace `process.argv` with `Deno.args`.
- Replace `process.env.BRAVE_API_KEY` with `Deno.env.get("BRAVE_API_KEY")`.
- Replace `process.exit()` with `Deno.exit()`.
- Import shared modules.
- Preserve API URL, headers, count cap, sequential content fetch, messages, and formatting.
- Guard execution with `if (import.meta.main)`.

**Step 4: Verify GREEN**

Run:

```bash
cd brave-search
deno test --allow-read --allow-run cli_test.js
deno test --allow-read --allow-run *.js
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add brave-search/search.js brave-search/content.js brave-search/cli_test.js
git commit -m "feat: run Brave Search commands with Deno"
```

### Task 4: Remove npm installation and update skill guidance

**Files:**
- Modify: `brave-search/SKILL.md`
- Delete: `brave-search/package.json`
- Delete: `brave-search/package-lock.json`
- Delete: `brave-search/.gitignore`
- Remove untracked/ignored directory: `brave-search/node_modules/`
- Create: `brave-search/skill_doc_test.js`

**Step 1: Write failing documentation test**

Assert `SKILL.md` starts with valid two-field frontmatter, has a trigger-only description beginning `Use when`, mentions Deno, retains all commands/options, and contains neither `npm install` nor `package.json`.

**Step 2: Verify RED**

Run: `cd brave-search && deno test --allow-read skill_doc_test.js`
Expected: FAIL because current setup requires npm and the description is not trigger-focused.

**Step 3: Update skill and remove artifacts**

Document Deno as the only runtime prerequisite, explain first-run caching, retain the API-key setup and CLI reference, and add concise troubleshooting. Remove npm manifests, lockfile, installed modules, and obsolete ignore file.

**Step 4: Verify GREEN**

Run: `cd brave-search && deno test --allow-read skill_doc_test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add -A brave-search
git commit -m "docs: update Brave Search skill for Deno"
```

### Task 5: Final verification

**Files:**
- No changes expected

**Step 1: Run formatter and checks**

```bash
cd brave-search
deno fmt --check *.js SKILL.md
deno lint *.js
deno test --allow-read --allow-run *.js
./search.js
./content.js
```

Expected: format/lint/tests pass; both no-argument smoke tests print existing usage and exit 1.

**Step 2: Confirm artifact removal and diff**

```bash
test ! -e package.json
test ! -e package-lock.json
test ! -d node_modules
git status --short
git diff HEAD~4 -- brave-search
```

Expected: artifact checks pass and only planned Brave Search changes appear.

**Step 3: Run a reference-skill application check**

Give a fresh agent the rewritten `SKILL.md` and ask how to perform a basic search, a freshness-filtered content search, and standalone extraction. Verify it chooses the Deno executables without suggesting npm installation.

**Step 4: Commit formatting fixes only if needed**

```bash
git add brave-search
git commit -m "style: format Brave Search Deno scripts"
```
