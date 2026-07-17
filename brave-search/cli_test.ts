import {
  assertEquals,
  assertStringIncludes,
} from "jsr:@std/assert@1.0.16";

const decoder = new TextDecoder();
const deno = Deno.execPath();

async function run(script: string) {
  return await new Deno.Command(deno, {
    args: [
      "run",
      "--allow-net",
      "--allow-read",
      "--allow-env",
      "--allow-run=kill",
      "--node-modules-dir=none",
      script,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
}

const shebangs = {
  "search.ts": "#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env --allow-run=kill --node-modules-dir=none",
  "content.ts": "#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env --node-modules-dir=none",
};

for (const [script, shebang] of Object.entries(shebangs)) {
  Deno.test(`${script} uses the Deno shebang`, async () => {
    const source = await Deno.readTextFile(script);
    assertEquals(source.split("\n", 1)[0], shebang);
  });
}

Deno.test("search routes Brave fetch through rate limiter", async () => {
  const source = await Deno.readTextFile("search.ts");
  assertStringIncludes(source, 'from "./rate_limit.ts"');
  assertStringIncludes(source, "await withBraveRateLimit(() => fetch(");
});

Deno.test("search without arguments prints TypeScript usage", async () => {
  const output = await run("search.ts");
  assertEquals(output.code, 1);
  assertStringIncludes(
    decoder.decode(output.stdout),
    "Usage: search.ts <query> [-n <num>] [--content] [--country <code>] [--freshness <period>]",
  );
});

Deno.test("content without arguments prints TypeScript usage", async () => {
  const output = await run("content.ts");
  assertEquals(output.code, 1);
  assertStringIncludes(
    decoder.decode(output.stdout),
    "Usage: content.ts <url>",
  );
});
