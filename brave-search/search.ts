#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env --node-modules-dir=none

import {
  formatResults,
  parseSearchArgs,
  type SearchResult,
} from "./search_core.ts";
import { fetchPageContent } from "./web_content.ts";

const USAGE = `Usage: search.ts <query> [-n <num>] [--content] [--country <code>] [--freshness <period>]

Options:
  -n <num>              Number of results (default: 5, max: 20)
  --content             Fetch readable content as markdown
  --country <code>      Country code for results (default: US)
  --freshness <period>  Filter by time: pd (day), pw (week), pm (month), py (year)

Environment:
  BRAVE_API_KEY         Required. Your Brave Search API key.

Examples:
  search.ts "javascript async await"
  search.ts "rust programming" -n 10
  search.ts "climate change" --content
  search.ts "news today" --freshness pd`;

interface BraveWebResult {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  page_age?: string;
}

interface BraveResponse {
  web?: { results?: BraveWebResult[] };
}

async function fetchBraveResults(
  query: string,
  numResults: number,
  country: string,
  freshness: string | null,
  apiKey: string,
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    count: Math.min(numResults, 20).toString(),
    country,
  });
  if (freshness) params.append("freshness", freshness);

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `HTTP ${response.status}: ${response.statusText}\n${errorText}`,
    );
  }

  const data = await response.json() as BraveResponse;
  const results: SearchResult[] = [];
  for (const result of data.web?.results ?? []) {
    if (results.length >= numResults) break;
    results.push({
      title: result.title || "",
      link: result.url || "",
      snippet: result.description || "",
      age: result.age || result.page_age || "",
    });
  }
  return results;
}

async function main(): Promise<void> {
  const options = parseSearchArgs(Deno.args);
  if (!options.query) {
    console.log(USAGE);
    Deno.exit(1);
  }

  const apiKey = Deno.env.get("BRAVE_API_KEY");
  if (!apiKey) {
    console.error("Error: BRAVE_API_KEY environment variable is required.");
    console.error(
      "Get your API key at: https://api-dashboard.search.brave.com/app/keys",
    );
    Deno.exit(1);
  }

  try {
    const results = await fetchBraveResults(
      options.query,
      options.numResults,
      options.country,
      options.freshness,
      apiKey,
    );
    if (results.length === 0) {
      console.error("No results found.");
      return;
    }

    if (options.fetchContent) {
      for (const result of results) {
        result.content = await fetchPageContent(result.link);
      }
    }

    console.log(formatResults(results));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) await main();
