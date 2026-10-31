#!/usr/bin/env node
/* sentinel.cjs — put the patch back before the relaunched shell can read it.
 *
 * The problem this process exists for
 * ----------------------------------
 * `transparent: true` is a `new BrowserWindow(...)` option, so it lives in the
 * shell's `app.asar`. A Desktop update replaces that archive; the shell the
 * installer relaunches therefore creates an opaque window, and no plugin can do
 * anything about it — plugins are loaded *after* that window exists. Measured on
 * 44.7.0: the theme's host half notices a stock shell ~3 s after launch and used
 * to need ~85 s to rewrite the archive, i.e. the opaque boot frame was gone long
 * before the fix landed.
 *
 * The only place where the patch can win is the gap between "the installer has
 * finished writing app.asar" and "the installer starts the new shell". That gap
 * is not ours to hook — but it is ours to *watch*: this process is started by
 * the plugin host, survives the host (detached), and rewrites the archive the
 * moment it changes. `fast.cjs` (the streaming repacker next door) is what makes
 * this possible: ~1.5 s instead of ~85 s.
 *
 * Lifecycle
 * ---------
 *   1. Started on every host load (see `index.js`), one per installation — a
 *      lock file keeps two of them apart.
 *   2. While the app is running it is almost free: one `stat` per second plus a
 *      directory watch. No polling of the archive contents.
 *   3. When the host process disappears (the app quits — including "restart and
 *      update"), it enters its guard window and keeps watching for three more
 *      minutes, then exits. A normal quit costs one idle process for that long.
 *   4. Any change to app.asar starts a patch attempt; attempts are retried for a
 *      few seconds because the installer writes the file in place and a partial
 *      archive must be left alone, not half-rewritten.
 *   5. After a successful patch with the app still gone, it exits: the next
 *      launch is transparent, and the next host load starts a fresh sentinel.
 *
 * What it will not do
 * -------------------
 *   - It never patches an archive it could not parse, or one that is still being
 *     written (short read / payload past EOF).
 *   - It never repairs a *stale* revision (that is `auto.cjs --repair`, a human
 *     decision — the pristine archive it would restore predates other edits).
 *   - It never touches an installation it does not run from, unless `--app`
 *     names one explicitly.
 *   - It never throws into the host: every failure is a log line and a quiet
 *     exit. `index.js` also passes `DSH_THEME_AUTO_PATCH=0` through, so the
 *     user-facing off switch keeps working.
 *
 * Usage
 *   node shell-patch/sentinel.cjs --parent <pid>          run until the app quits + 3 min
 *   node shell-patch/sentinel.cjs --app <dir> --once      patch once, exit (diagnostics)
 *   node shell-patch/sentinel.cjs --status                report and exit
 */
'use strict';

const fs = require('./lib/real-fs.cjs');
const path = require('path');
const target = require('./target.cjs');
const fast = require('./fast.cjs');

const LOCK_FILE = path.join(__dirname, '.sentinel.lock');
const LOG_FILE = path.join(__dirname, 'sentinel.log');
const LOG_LIMIT = 256 * 1024;
/** How long to keep watching after the host process disappears (update install). */
const DEFAULT_GRACE_MS = 180_000;
/** Hard stop, so a leaked process cannot live forever. */
const MAX_LIFETIME_MS = 24 * 60 * 60 * 1000;
/** Retry budget for one archive change (the installer may still be writing). */
const PATCH_ATTEMPTS = 40;
const PATCH_RETRY_MS = 200;
const POLL_MS = 1_000;
const GUARD_POLL_MS = 250;

function log(line) {
  const text = `${new Date().toISOString()} ${line}\n`;
  try {
    try {
      if (fs.statSync(LOG_FILE).size > LOG_LIMIT) fs.rmSync(LOG_FILE, { force: true });
    } catch { /* no log yet */ }
    fs.appendFileSync(LOG_FILE, text);
  } catch { /* a read-only install directory must not break the guard */ }
}

function parseArgs(argv) {
  const options = { app: undefined, parent: undefined, grace: DEFAULT_GRACE_MS, once: false, status: false, quiet: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--app') options.app = argv[++index];
    else if (arg === '--parent') options.parent = Number(argv[++index]);
    else if (arg === '--grace') options.grace = Number(argv[++index]) * 1000;
    else if (arg === '--once') options.once = true;
    else if (arg === '--status') options.status = true;
    else if (arg === '--quiet' || arg === '-q') options.quiet = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/** One sentinel per installation; an older live one keeps the job. */
function acquireLock() {
  try {
    const [pid, at] = fs.readFileSync(LOCK_FILE, 'utf8').trim().split(/\s+/u);
    if (alive(Number(pid)) && Date.now() - Number(at) < MAX_LIFETIME_MS) return false;
  } catch { /* no lock */ }
  try {
    fs.writeFileSync(LOCK_FILE, `${process.pid} ${Date.now()}\n`);
    return true;
  } catch {
    return false;
  }
}

function releaseLock() {
  try {
    const [pid] = fs.readFileSync(LOCK_FILE, 'utf8').trim().split(/\s+/u);
    if (Number(pid) === process.pid) fs.rmSync(LOCK_FILE, { force: true });
  } catch { /* leave it; the staleness rule clears it */ }
}

/**
 * Try to patch, tolerating an archive that is still being written.
 *
 * `fast.patch` refuses anything it cannot parse and verifies its own output, so
 * the failure mode here is "nothing happened", never "half a patch". Retrying is
 * the whole strategy: the installer writes 170 MiB in place, and the first few
 * attempts will see a header whose payloads run past the end of the file.
 * @returns {{patched: boolean, result?: object, error?: string}}
 */
async function tryPatch(app, attempts = PATCH_ATTEMPTS) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const result = fast.patch(['--app', app, '--quiet']);
      if (result.action === 'apply' || result.action === 'apply-in-place') return { patched: true, result };
      if (result.state === 'current') return { patched: false, result };
      lastError = result.reason ?? result.state;
      if (result.state === 'stale' || result.state === 'mixed') {
        // Not a race: a different revision, or a shell this patch set does not
        // know. Retrying cannot help. (`unreadable` IS retryable: it is exactly
        // what a half-written archive looks like.)
        return { patched: false, result, error: lastError };
      }
    } catch (error) {
      lastError = error && error.message ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, PATCH_RETRY_MS));
  }
  return { patched: false, error: lastError };
}

/**
 * Watch one installation until the guard window closes.
 * @param {{app: string, parent?: number, grace: number, quiet: boolean}} options
 */
async function guard(options) {
  const archive = path.join(options.app, 'resources', 'app.asar');
  const directory = path.dirname(archive);
  const started = Date.now();
  let parentAlive = options.parent === undefined ? true : alive(options.parent);
  let deadline = 0;
  let patched = 0;
  let lastSignature = '';

  const signature = () => {
    try {
      const stat = fs.statSync(archive);
      return `${stat.size}:${stat.mtimeMs}`;
    } catch {
      return 'missing';
    }
  };

  const onArchiveMaybeChanged = async (why) => {
    const result = await tryPatch(options.app);
    if (result.patched) {
      patched++;
      lastSignature = signature();
      if (!options.quiet) log(`patched via ${why} in ${result.result?.ms ?? '?'} ms (attempt ${patched})`);
    } else if (result.error !== undefined && !options.quiet) {
      log(`left alone (${why}): ${result.error}`);
    }
  };

  lastSignature = signature();
  // A shell that is stock *now* means the race was already lost (or this is the
  // first run after an install that bypassed package lifecycle scripts). Patch it
  // immediately: it is cheap, and it turns "opaque until I remember to restart"
  // into "opaque for this one launch" either way.
  const initial = await tryPatch(options.app);
  if (initial.patched) {
    patched++;
    lastSignature = signature();
    if (!options.quiet) log(`patched on start in ${initial.result?.ms ?? '?'} ms`);
  }
  let watcher;
  try {
    watcher = fs.watch(directory, { persistent: false }, (_event, name) => {
      if (name !== null && name !== undefined && name !== 'app.asar') return;
      void onArchiveMaybeChanged('watch');
    });
  } catch (error) {
    log(`fs.watch unavailable (${error.code ?? error.message}); polling only`);
  }

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, parentAlive ? POLL_MS : GUARD_POLL_MS));
    const now = Date.now();
    if (now - started > MAX_LIFETIME_MS) {
      log('hard lifetime cap reached; exiting');
      break;
    }
    if (parentAlive) {
      parentAlive = options.parent === undefined ? true : alive(options.parent);
      if (!parentAlive) {
        deadline = now + options.grace;
        log(`host ${options.parent} is gone; guarding ${Math.round(options.grace / 1000)} s for an install`);
      }
    }
    // A fresh signature means somebody rewrote the archive between watch events
    // (or the watch was unavailable); the patch attempt is cheap and idempotent.
    const current = signature();
    if (current !== lastSignature) {
      lastSignature = current;
      await onArchiveMaybeChanged('stat');
    }
    if (options.once) return { patched };
    if (!parentAlive) {
      if (patched > 0 && now > deadline - options.grace + 2_000) return { patched };
      if (now > deadline) {
        log(`guard window closed (${patched} patch(es))`);
        return { patched };
      }
    }
  }
  try { watcher?.close(); } catch { /* already closed */ }
  return { patched };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const found = target.resolveApp({ explicit: options.app });
  if (found.app === null) {
    if (options.status) console.log('[sentinel] no installation found');
    return 0;
  }
  if (options.status) {
    const probe = target.probeShell(found.app);
    console.log(`[sentinel] ${found.app} :: ${probe.state}`);
    return 0;
  }
  if (options.app === undefined && found.insideApp !== true) {
    // A web profile on a machine that also has the Desktop must not rewrite the
    // Desktop's archive — same rule as auto.cjs.
    return 0;
  }
  if (!acquireLock()) {
    if (!options.quiet) log('another sentinel is already guarding this installation');
    return 0;
  }
  process.on('exit', releaseLock);
  try {
    if (!options.quiet) log(`started for ${found.app} (parent ${options.parent ?? 'none'}, pid ${process.pid})`);
    const result = await guard({ app: found.app, parent: options.parent, grace: options.grace, quiet: options.quiet });
    if (!options.quiet) log(`stopped after ${result.patched} patch(es)`);
    return 0;
  } finally {
    releaseLock();
  }
}

module.exports = { main, guard, tryPatch, LOCK_FILE, LOG_FILE };

if (require.main === module) {
  main().then(
    (code) => { process.exitCode = code; },
    (error) => {
      log(`FAILED ${error && error.stack ? error.stack : error}`);
      process.exitCode = 1;
    },
  );
}
