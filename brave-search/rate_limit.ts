const POLL_MS = 100;
const COOLDOWN_MS = 1050;
const STALE_MS = 30_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type LockDecision = "wait" | "log" | "reap";

export function decideLock(
  { ageMs, pidAlive, logDue }: {
    ageMs: number;
    pidAlive: boolean;
    logDue: boolean;
  },
): LockDecision {
  if (ageMs > STALE_MS || !pidAlive) return "reap";
  return logDue ? "log" : "wait";
}

export function defaultRateLimitStateDir(): string {
  const root = Deno.env.get("XDG_RUNTIME_DIR") ??
    Deno.env.get("TMPDIR") ?? "/tmp";
  return `${root}/brave-search-${Deno.uid()}`;
}

export async function tryLock(
  stateDir: string,
  pid = Deno.pid,
): Promise<boolean> {
  await Deno.mkdir(stateDir, { recursive: true, mode: 0o700 });
  const lock = `${stateDir}/lock`;
  try {
    await Deno.mkdir(lock);
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) return false;
    throw error;
  }
  try {
    await Deno.writeTextFile(`${lock}/pid`, String(pid));
    return true;
  } catch (error) {
    await unlock(stateDir);
    throw error;
  }
}

export async function unlock(stateDir: string): Promise<void> {
  try {
    await Deno.remove(`${stateDir}/lock`, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
}

async function alive(pid: number): Promise<boolean> {
  return (await new Deno.Command("kill", {
    args: ["-0", String(pid)],
    stdout: "null",
    stderr: "null",
  }).output()).success;
}

async function acquire(stateDir: string): Promise<void> {
  let nextLog = 0;
  while (!await tryLock(stateDir)) {
    try {
      const lock = `${stateDir}/lock`;
      const stat = await Deno.stat(lock);
      const rawPid = await Deno.readTextFile(`${lock}/pid`).catch(() => "");
      const pid = Number.parseInt(rawPid, 10);
      const ageMs = Date.now() - (stat.mtime?.getTime() ?? Date.now());
      const pidAlive = Number.isNaN(pid) || ageMs > STALE_MS || await alive(pid);
      const decision = decideLock({
        ageMs,
        pidAlive,
        logDue: Date.now() >= nextLog,
      });

      if (decision === "reap") {
        await unlock(stateDir);
        continue;
      }
      if (decision === "log") {
        console.error(
          `Brave search busy; waiting${Number.isNaN(pid) ? "" : ` for PID ${pid}`}`,
        );
        nextLog = Date.now() + 1000;
      }
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
    await sleep(POLL_MS);
  }
}

export async function withBraveRateLimit<T>(
  action: () => Promise<T>,
): Promise<T> {
  const stateDir = defaultRateLimitStateDir();
  await acquire(stateDir);
  try {
    return await action();
  } finally {
    await sleep(COOLDOWN_MS);
    await unlock(stateDir);
  }
}
