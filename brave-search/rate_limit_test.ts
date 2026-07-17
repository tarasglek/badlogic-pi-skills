import { assertEquals } from "jsr:@std/assert@1.0.16";
import { decideLock, tryLock, unlock } from "./rate_limit.ts";

Deno.test("decideLock handles live, dead, stale, and log-due locks", () => {
  assertEquals(
    decideLock({ ageMs: 0, pidAlive: true, logDue: false }),
    "wait",
  );
  assertEquals(
    decideLock({ ageMs: 0, pidAlive: false, logDue: false }),
    "reap",
  );
  assertEquals(
    decideLock({ ageMs: 30_001, pidAlive: true, logDue: false }),
    "reap",
  );
  assertEquals(
    decideLock({ ageMs: 0, pidAlive: true, logDue: true }),
    "log",
  );
});

Deno.test("filesystem lock is atomic and reusable", async () => {
  const stateDir = await Deno.makeTempDir();
  try {
    assertEquals(await tryLock(stateDir, 123), true);
    assertEquals(await tryLock(stateDir, 456), false);
    assertEquals(await Deno.readTextFile(`${stateDir}/lock/pid`), "123");
    await unlock(stateDir);
    assertEquals(await tryLock(stateDir, 456), true);
  } finally {
    await Deno.remove(stateDir, { recursive: true });
  }
});
