# Brave Search Cross-Process Rate Limiter Design

## Goal

Prevent concurrent Brave Search CLI processes on one Linux or macOS machine from exceeding the account's one-request-per-second limit. Contending searches wait rather than fail.

## Design

Use one atomic lock directory per local user. Select its parent from `XDG_RUNTIME_DIR`, then `TMPDIR`, then `/tmp`; create a private `brave-search-<uid>` state directory with mode `0700`. The lock is `<state>/lock`.

Before calling the Brave API, a process repeatedly tries to create the lock directory with `Deno.mkdir`. Directory creation is atomic on Linux and macOS, so only one process wins. The winner writes its PID to `<state>/lock/pid`, performs the Brave API request, waits 1.05 seconds after the response, and removes the lock in `finally`. Other processes sleep briefly and retry until they acquire it. A blocked process writes a status message to stderr once per second while waiting, including the owner PID when available; stdout remains stable for callers that parse search results.

This deliberately serializes complete Brave API requests. It is more conservative than reserving timestamped slots, but needs only one lock directory and directly matches the free account's one-request-per-second limit.

## Crash Recovery

A process can die after creating the lock. A contender reads `lock/pid` and invokes POSIX `kill -0 <pid>` to test whether the owner exists without sending a signal.

- Live owner: wait and retry.
- Dead owner: remove the abandoned lock and retry.
- Missing PID: treat it as a newly-created lock and wait briefly.
- Lock older than 30 seconds: remove it regardless, protecting against PID reuse or a permanently stuck owner.

The Brave fetch receives a 15-second timeout, keeping normal lock ownership below the stale threshold. Races while removing stale locks are harmless; processes return to the acquisition loop.

`kill -0` is available on both Linux and macOS. The Deno command therefore adds narrowly scoped `--allow-run=kill` permission.

## API and Integration

A small `rate_limit.ts` module owns state selection, lock acquisition, owner checks, cleanup, and a `withBraveRateLimit` wrapper. `search.ts` wraps only the Brave API fetch. Direct result-page fetches used by `--content` are not Brave API calls and remain outside the lock.

The existing CLI flags, output, API key handling, and non-rate-limit HTTP error behavior remain unchanged.

## Testing

Sans-I/O unit tests use an in-memory lock backend plus injected timing, logging, and process checks. One small integration test uses a temporary directory to verify Deno's real atomic lock operations. Tests verify:

- one caller acquires and releases the lock;
- a second caller waits while a live owner holds it;
- a dead owner's lock is reclaimed;
- an old lock is reclaimed;
- cleanup occurs when the wrapped request throws;
- blocked-wait status is emitted to stderr at one-second intervals without flooding each poll.

CLI tests verify the updated Deno permission shebang. The full test suite and `deno check` verify integration.
