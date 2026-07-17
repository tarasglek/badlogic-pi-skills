# Brave Search Deno Rewrite Design

## Goal

Run the Brave Search skill with Deno while preserving the existing `search.js` and `content.js` command paths, CLI options, output format, extraction behavior, and environment variable contract. Remove the local npm installation requirement and npm artifacts.

## Architecture

- Keep `search.js` and `content.js` as executable Deno entry points with Deno shebangs.
- Add one shared module for HTML fetching, readable-content extraction, and Markdown conversion.
- Use pinned `npm:` imports supported by Deno for Mozilla Readability, DOM parsing, Turndown, and its GFM plugin.
- Replace Node globals with `Deno.args`, `Deno.env`, and `import.meta.main`.
- Grant only the required permissions through each executable's shebang: network access for both commands and environment access for search.

## Compatibility

The rewrite preserves:

- Executable names: `search.js`, `content.js`
- Search flags: `-n`, `--content`, `--country`, and `--freshness`
- `BRAVE_API_KEY`
- Result and error output
- Search result limit and content truncation
- Existing fetch headers and timeouts

`package.json`, `package-lock.json`, `node_modules`, and the npm-focused `.gitignore` entry will be removed. No `npm install` step remains.

## Testing

Deno tests will cover deterministic behavior without external network calls:

- Search argument parsing and defaults
- Search result formatting
- HTML-to-Markdown conversion and readable-content extraction using local fixtures
- Error/fallback behavior where practical

Tests will be written and observed failing before implementation. Final verification will run `deno test` and executable help/usage smoke tests.

## Skill Documentation

Update `SKILL.md` to:

- Use a trigger-focused description
- State Deno as the only runtime prerequisite
- Remove npm setup instructions
- Keep all existing usage examples and explain Deno's first-run dependency cache behavior
- Add concise troubleshooting for permissions, API key errors, and dependency caching
