# Brave Search Rate Limiter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Serialize Brave API requests from concurrent Linux/macOS CLI processes and recover locks left by crashed processes.

**Architecture:** A Deno module atomically creates one per-user lock directory, writes its PID, and holds the lock through the Brave request plus a 1.05-second cooldown. Contenders poll, report waiting to stderr once per second, and reclaim locks whose PID is dead or whose age exceeds 30 seconds.

**Tech Stack:** Deno 2 TypeScript, POSIX `kill -0`, Deno test and `@std/assert`.

---

### Task 1: Build the cross-process lock

**Files:**
- Create: `brave-search/rate_limit.ts`
- Create: `brave-search/rate_limit_test.ts`

**Step 1: Write failing tests**

Add sans-I/O table tests for one pure decision function:

```ts
Deno.test("decideLock handles live, dead, stale, and log-due locks", () => {
  assertEquals(decideLock({ ageMs: 0, pidAlive: true, logDue: false }), "wait");
  assertEquals(decideLock({ ageMs: 0, pidAlive: false, logDue: false }), "reap");
  assertEquals(decideLock({ ageMs: 30_001, pidAlive: true, logDue: false }), "reap");
  assertEquals(decideLock({ ageMs: 0, pidAlive: true, logDue: true }), "log");
});
```

Add one small integration test using `Deno.makeTempDir`: verify `tryLock` succeeds once, fails while held, writes the owner PID, and succeeds again after `unlock`. Keep all other tests free of filesystem, process, network, and real-time I/O.

**Step 2: Run test to verify it fails**

Run:

```bash
cd brave-search
deno test --allow-read --allow-write rate_limit_test.ts
```

Expected: FAIL because `rate_limit.ts` does not exist.

**Step 3: Implement minimal lock module**

Keep the production API brutally small:

```ts
export type LockDecision = "wait" | "log" | "reap";
export function decideLock(state: {
  ageMs: number;
  pidAlive: boolean;
  logDue: boolean;
}): LockDecision;
export function defaultRateLimitStateDir(): string;
export async function tryLock(stateDir: string, pid?: number): Promise<boolean>;
export async function unlock(stateDir: string): Promise<void>;
export async function withBraveRateLimit<T>(action: () => Promise<T>): Promise<T>;
```

State location:

```ts
const runtimeDir = Deno.env.get("XDG_RUNTIME_DIR") ??
  Deno.env.get("TMPDIR") ?? "/tmp";
return `${runtimeDir}/brave-search-${Deno.uid()}`;
```

Implement this directly, without backend classes or a general framework. Acquisition algorithm:

1. Create state directory mode `0700`.
2. Try atomic `Deno.mkdir(lockDir)`.
3. Winner writes `Deno.pid` to `lock/pid`.
4. On `AlreadyExists`, inspect PID and lock mtime.
5. Remove lock if age is over 30 seconds or `kill -0` says PID is dead.
6. Otherwise log to stderr at most once per second, sleep 100ms, retry.
7. Run action while holding lock.
8. In `finally`, sleep 1050ms and recursively remove lock.

Default liveness check:

```ts
const result = await new Deno.Command("kill", {
  args: ["-0", String(pid)],
  stdout: "null",
  stderr: "null",
}).output();
return result.success;
```

Handle missing/invalid PID as a possibly-new lock until stale. Ignore `NotFound` races during stale cleanup and loop again.

**Step 4: Run tests to verify they pass**

```bash
deno test --allow-read --allow-write rate_limit_test.ts
```

Expected: all rate limiter tests PASS.

**Step 5: Commit**

```bash
git add brave-search/rate_limit.ts brave-search/rate_limit_test.ts
git commit -m "feat: add cross-process Brave rate limiter"
```

### Task 2: Route Brave requests through the lock

**Files:**
- Modify: `brave-search/search.ts`
- Modify: `brave-search/cli_test.ts`

**Step 1: Write failing CLI expectations**

Update the expected `search.ts` shebang to:

```text
#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env --allow-run=kill --node-modules-dir=none
```

Update the child Deno command in `cli_test.ts` to grant `--allow-run=kill`. Add a source-level assertion that `search.ts` imports and calls `withBraveRateLimit` around its Brave fetch.

**Step 2: Run test to verify it fails**

```bash
deno test --allow-read --allow-run cli_test.ts
```

Expected: FAIL because shebang and integration are absent.

**Step 3: Integrate the limiter**

In `search.ts`:

```ts
import { withBraveRateLimit } from "./rate_limit.ts";
```

Wrap only the Brave API request:

```ts
const response = await withBraveRateLimit(() => fetch(url, {
  headers,
  signal: AbortSignal.timeout(15_000),
}));
```

Do not lock result-page fetches performed for `--content`. Preserve response parsing, errors, output, flags, and API-key behavior.

**Step 4: Run focused and full tests**

```bash
deno test --allow-read --allow-run cli_test.ts
deno test --allow-read --allow-write --allow-run --allow-env --node-modules-dir=none *_test.ts
deno check --allow-import search.ts content.ts
```

Expected: all tests PASS and both entry points check successfully.

**Step 5: Commit**

```bash
git add brave-search/search.ts brave-search/cli_test.ts
git commit -m "feat: serialize concurrent Brave searches"
```

### Task 3: Document runtime behavior

**Files:**
- Modify: `brave-search/SKILL.md`

**Step 1: Update documentation**

Document that concurrent `search.ts` processes on one Linux/macOS user account wait behind a local PID lock and print one stderr status message per second while blocked. Mention stale lock recovery and the added `kill` execution permission. Use TypeScript command names and remove stale npm installation instructions while touching the setup section.

**Step 2: Verify documentation references**

```bash
rg 'search\.js|content\.js|npm install|node_modules' brave-search/SKILL.md
```

Expected: no matches.

**Step 3: Run final verification**

```bash
cd brave-search
deno test --allow-read --allow-write --allow-run --allow-env --node-modules-dir=none *_test.ts
deno check --allow-import search.ts content.ts
git status --short
```

Expected: tests PASS, checks PASS, and only `SKILL.md` is modified.

**Step 4: Commit**

```bash
git add brave-search/SKILL.md
git commit -m "docs: explain Brave search rate limiting"
```
