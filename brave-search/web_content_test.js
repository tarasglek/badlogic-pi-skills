import {
  assertEquals,
  assertMatch,
} from "jsr:@std/assert@1.0.16";
import { extractPageHtml, htmlToMarkdown } from "./web_content.js";

Deno.test("htmlToMarkdown uses GFM and removes empty links", () => {
  const markdown = htmlToMarkdown(`
    <h2>Heading</h2>
    <a href="https://empty.example"><span></span></a>
    <table><thead><tr><th>Name</th></tr></thead>
    <tbody><tr><td>Deno</td></tr></tbody></table>
    <pre><code>const runtime = "deno";</code></pre>
  `);

  assertMatch(markdown, /^## Heading/m);
  assertMatch(markdown, /\| Name\s+\|/);
  assertMatch(markdown, /```\nconst runtime = "deno";\n```/);
  assertEquals(markdown.includes("empty.example"), false);
});

Deno.test("extractPageHtml extracts a readable article", () => {
  const extracted = extractPageHtml(
    `<!doctype html><html><head><title>Fallback title</title></head><body>
      <article><h1>Deno Article</h1>
      <p>This is a substantial article paragraph with enough prose to let the readability algorithm identify the primary content of this test document.</p>
      <p>A second substantial paragraph supplies additional readable text and ensures the article is preferred over surrounding navigation.</p>
      </article><nav>Ignore this navigation</nav>
    </body></html>`,
    "https://example.com/article",
  );

  assertMatch(extracted.content, /Deno Article/);
  assertMatch(extracted.content, /substantial article paragraph/);
  assertEquals(extracted.content.includes("Ignore this navigation"), false);
});

Deno.test("extractPageHtml falls back to main content and removes noise", () => {
  const extracted = extractPageHtml(
    `<!doctype html><html><head><title>Fallback Page</title></head><body>
      <nav>Navigation noise</nav><script>script noise</script>
      <main><h2>Main heading</h2><p>${"Useful fallback content ".repeat(8)}</p></main>
    </body></html>`,
    "https://example.com/fallback",
    { readability: false },
  );

  assertEquals(extracted.title, "Fallback Page");
  assertMatch(extracted.content, /## Main heading/);
  assertEquals(extracted.content.includes("Navigation noise"), false);
  assertEquals(extracted.content.includes("script noise"), false);
});

Deno.test("extractPageHtml reports an empty page", () => {
  const extracted = extractPageHtml(
    "<html><body><main>short</main></body></html>",
    "https://example.com/empty",
    { readability: false },
  );

  assertEquals(extracted.content, null);
});
