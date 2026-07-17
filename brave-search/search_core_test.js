import { assertEquals } from "jsr:@std/assert@1.0.16";
import { formatResults, parseSearchArgs } from "./search_core.js";

Deno.test("parseSearchArgs returns existing defaults", () => {
  assertEquals(parseSearchArgs([]), {
    query: "",
    fetchContent: false,
    numResults: 5,
    country: "US",
    freshness: null,
  });
});

Deno.test("parseSearchArgs removes flags and joins the remaining query", () => {
  assertEquals(
    parseSearchArgs([
      "rust",
      "ownership",
      "--content",
      "-n",
      "10",
      "--country",
      "de",
      "--freshness",
      "pw",
    ]),
    {
      query: "rust ownership",
      fetchContent: true,
      numResults: 10,
      country: "DE",
      freshness: "pw",
    },
  );
});

Deno.test("parseSearchArgs preserves parseInt compatibility", () => {
  assertEquals(parseSearchArgs(["query", "-n", "12results"]).numResults, 12);
});

Deno.test("formatResults reproduces result blocks and optional fields", () => {
  assertEquals(
    formatResults([
      {
        title: "First",
        link: "https://example.com/one",
        age: "2 days ago",
        snippet: "One snippet",
        content: "# Article\n\nBody",
      },
      {
        title: "Second",
        link: "https://example.com/two",
        snippet: "Two snippet",
      },
    ]),
    `--- Result 1 ---
Title: First
Link: https://example.com/one
Age: 2 days ago
Snippet: One snippet
Content:
# Article

Body

--- Result 2 ---
Title: Second
Link: https://example.com/two
Snippet: Two snippet
`,
  );
});
