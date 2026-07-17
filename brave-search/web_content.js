import { Readability } from "npm:@mozilla/readability@0.6.0";
import { JSDOM } from "npm:jsdom@27.0.1";
import TurndownService from "npm:turndown@7.2.2";
import { gfm } from "npm:turndown-plugin-gfm@1.0.2";

export const PAGE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export function htmlToMarkdown(html) {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  turndown.use(gfm);
  turndown.addRule("removeEmptyLinks", {
    filter: (node) => node.nodeName === "A" && !node.textContent?.trim(),
    replacement: () => "",
  });

  return turndown
    .turndown(html)
    .replace(/\[\\?\[\s*\\?\]\]\([^)]*\)/g, "")
    .replace(/ +/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractPageHtml(html, url, options = {}) {
  if (options.readability !== false) {
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    if (article?.content) {
      return {
        title: article.title || null,
        content: htmlToMarkdown(article.content),
      };
    }
  }

  const fallbackDom = new JSDOM(html, { url });
  const document = fallbackDom.window.document;
  document.querySelectorAll("script, style, noscript, nav, header, footer, aside")
    .forEach((element) => element.remove());
  const main = document.querySelector(
    "main, article, [role='main'], .content, #content",
  ) || document.body;
  const text = main?.textContent?.trim() || "";

  return {
    title: document.querySelector("title")?.textContent?.trim() || null,
    content: text.length > 100 ? htmlToMarkdown(main.innerHTML) : null,
  };
}

export async function fetchPage(url, options = {}) {
  const response = await fetch(url, {
    headers: options.headers || PAGE_HEADERS,
    signal: AbortSignal.timeout(options.timeout ?? 15_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return extractPageHtml(await response.text(), url);
}

export async function fetchPageContent(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: options.headers || PAGE_HEADERS,
      signal: AbortSignal.timeout(options.timeout ?? 10_000),
    });
    if (!response.ok) return `(HTTP ${response.status})`;

    const extracted = extractPageHtml(await response.text(), url);
    if (!extracted.content) return "(Could not extract content)";
    return extracted.content.substring(0, options.maxLength ?? 5_000);
  } catch (error) {
    return `(Error: ${error.message})`;
  }
}
