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
      "--node-modules-dir=none",
      script,
    ],
    stdout: "piped",
    stderr: "piped",
  }).output();
}

for (const script of ["search.ts", "content.ts"]) {
  Deno.test(`${script} uses the Deno shebang`, async () => {
    const source = await Deno.readTextFile(script);
    assertEquals(
      source.split("\n", 1)[0],
      "#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env --node-modules-dir=none",
    );
  });
}

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
