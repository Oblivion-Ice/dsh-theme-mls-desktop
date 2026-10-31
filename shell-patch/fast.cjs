#!/usr/bin/env node
/* fast.cjs — the same shell patch, applied in ~1 s instead of ~85 s.
 *
 * Why this file exists
 * --------------------
 * `apply.cjs` is written to be auditable, not quick: it extracts all ~16.6k
 * entries of the 170 MiB shell archive to disk, patches three files on the
 * extracted tree, repacks the whole tree, and then re-reads every entry to prove
 * the round trip. Measured on the reference machine (44.7.0, NVMe): **~85 s**.
 *
 * That is fine for the install-time path. It is useless for the one moment where
 * this patch actually matters: the shell gets `transparent: true` only in
 * `new BrowserWindow(...)`, so a Desktop update — which replaces `app.asar` —
 * leaves the *next* launch with an opaque window. The only way to keep that
 * launch transparent is to have the patch back on disk between "the installer
 * wrote app.asar" and "the installer relaunches the app". That window is a few
 * hundred milliseconds to a couple of seconds wide (see `sentinel.cjs`).
 *
 * So this file keeps the *edit* identical to `apply.cjs` (same `patches.cjs`
 * entries, same `applyPatch`, same revision gate) and replaces only the
 * packaging step with a streaming rewrite:
 *
 *   read header -> patch the three bodies in memory -> walk the data region in
 *   offset order, copying untouched spans byte-for-byte and splicing the three
 *   new bodies in at the right places -> rebuild the header -> verify -> rename
 *   over app.asar.
 *
 * The reference archive's data region is dense (measured: first entry at 0, no
 * gaps, no overlaps, `offset + size` chains exactly to the end of the file), so
 * the untouched payload is three or four memcpy runs rather than 16.6k reads.
 *
 * What is *not* copied from apply.cjs: the per-entry `integrity` blocks. The
 * shipped archive carries 18.2k of them (Electron's contentHash/block hashes);
 * `asar.createPackage` already drops them, which is why the theme's current
 * output has none, and why the shell loads it. This file drops them the same
 * way — patching a file without rewriting its integrity block would otherwise
 * leave a header that claims a hash the file no longer has.
 *
 * Safety
 * ------
 *   - Same anchors, same "exactly one hit" rule, same stale-revision refusal.
 *   - The new body must still introduce its marker and must still parse
 *     (`node --check`), and the revision comment must read `current`.
 *   - The new archive is written to `<archive>.marathon-fast-staging` and only
 *     renamed over the real one after it re-reads clean and its payload
 *     spot-checks byte-equal against the source.
 *   - Untouched bytes are copied, never regenerated, so an unrelated entry
 *     cannot change.
 *   - A failed run leaves `app.asar` exactly as it was.
 *
 * Usage
 *   node shell-patch/fast.cjs                 patch the installed shell if stock
 *   node shell-patch/fast.cjs --check         report, change nothing
 *   node shell-patch/fast.cjs --app <dir>     a specific installation
 *   node shell-patch/fast.cjs --json          machine-readable result
 *   node shell-patch/fast.cjs --no-backup     keep the existing .bak untouched
 */
'use strict';

const fs = require('./lib/real-fs.cjs');
const path = require('path');
const asar = require('./lib/asar.cjs');
const target = require('./target.cjs');
const { PATCHES, TARGET_FILES, revisionState, revisionComment } = require('./patches.cjs');
const { applyPatch, classifyPatch } = require('./apply.cjs');

const STAGING_SUFFIX = '.marathon-fast-staging';
const BACKUP_SUFFIX = '.dsh-theme-marathon.bak';
/** Big enough that the data region is a handful of syscalls, small enough to be free. */
const CHUNK = 8 * 1024 * 1024;
/** How many untouched entries to re-read from the staged archive as a spot check. */
const SPOT_CHECKS = 6;

/* ------------------------------------------------------------------------- */
/* header shape                                                               */
/* ------------------------------------------------------------------------- */

/**
 * Flatten the header tree into the payload list this file streams over.
 *
 * `offset`/`size` are numbers here (the header stores them as strings), and the
 * payloads come back sorted by their offset in the source file so the copy pass
 * can run front to back.
 * @param {object} header - parsed asar header
 * @returns {{all: object[], payloads: object[], dataLength: number, contiguous: boolean}}
 */
function flatten(header, contentOffset = 0) {
  const all = [];
  const walk = (node, prefix) => {
    for (const [name, entry] of Object.entries(node.files ?? {})) {
      const relative = prefix === '' ? name : `${prefix}/${name}`;
      if (entry.files !== undefined) {
        walk(entry, relative);
        continue;
      }
      if (entry.link !== undefined) {
        all.push({ relative, node: entry, link: true });
        continue;
      }
      if (entry.unpacked === true) {
        all.push({ relative, node: entry, unpacked: true });
        continue;
      }
      all.push({ relative, node: entry, offset: Number(entry.offset ?? 0), size: Number(entry.size ?? 0) });
    }
  };
  walk(header, '');
  const payloads = all.filter((item) => item.link !== true && item.unpacked !== true)
    .sort((left, right) => left.offset - right.offset);
  let cursor = 0;
  let contiguous = true;
  let overlap = false;
  for (const item of payloads) {
    if (item.offset < cursor) overlap = true;
    if (item.offset !== cursor) contiguous = false;
    cursor = Math.max(cursor, item.offset + item.size);
  }
  return { header, all, payloads, dataLength: cursor, contiguous, overlap, contentOffset };
}

/** Read one payload range out of an archive. */
function readRange(fd, offset, size) {
  const buffer = Buffer.alloc(size);
  let read = 0;
  while (read < size) {
    const chunk = fs.readSync(fd, buffer, read, size - read, offset + read);
    if (chunk === 0) throw new Error(`asar: short read at ${offset}+${read}`);
    read += chunk;
  }
  return buffer;
}

/* ------------------------------------------------------------------------- */
/* the edit                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Produce the patched body for every file this patch set touches.
 *
 * Mirrors `apply.cjs`'s main loop exactly — including the revision gate that
 * refuses a file carrying an older revision, and the "first entry inserts the
 * marker" subtlety that `classifyPatch` documents — but reads the three bodies
 * straight out of the archive instead of an extracted tree.
 * @param {string} archive
 * @param {object} shape - flatten() result
 * @returns {Map<string, {text: string, before: string, size: number, offset: number}>}
 */
function patchBodies(archive, shape) {
  const fd = fs.openSync(archive, 'r');
  try {
    const byFile = new Map();
    for (const patch of PATCHES) {
      if (!byFile.has(patch.file)) {
        const item = shape.payloads.find((payload) => payload.relative === patch.file);
        if (item === undefined) throw new Error(`asar: ${patch.file} is not a payload entry`);
        const before = readRange(fd, shape.contentOffset + item.offset, item.size).toString('utf8');
        byFile.set(patch.file, { item, before, text: before });
      }
    }
    for (const file of TARGET_FILES) {
      const state = revisionState(file, byFile.get(file).before);
      if (state === 'stale') {
        throw new Error(`${file} carries an older revision of this patch (${revisionComment(file)}) — run revert.cjs, then apply`);
      }
      if (state === 'current') {
        // Already this revision: nothing to do, and definitely nothing to rewrite.
        return null;
      }
    }
    const patched = new Map();
    const bodyOf = (file) => patched.get(file) ?? byFile.get(file).text;
    for (const patch of PATCHES) {
      const current = bodyOf(patch.file);
      const original = byFile.get(patch.file).before;
      const verdict = classifyPatch(original, current, patch);
      if (verdict === 'applied') continue;
      if (verdict === 'stale') throw new Error(`${patch.file} :: ${patch.name} is a stale revision — run revert.cjs, then apply`);
      const next = applyPatch(current, patch);
      if (!patched.has(patch.file)) {
        patched.set(patch.file, next);
        continue;
      }
      patched.set(patch.file, next);
    }
    for (const file of TARGET_FILES) {
      const text = patched.get(file) ?? byFile.get(file).text;
      const state = revisionState(file, text);
      if (state !== 'current') throw new Error(`${file} would still read "${state}" after patching (${revisionComment(file)})`);
      patched.set(file, text);
    }
    return patched;
  } finally {
    fs.closeSync(fd);
  }
}

/* ------------------------------------------------------------------------- */
/* the pack                                                                   */
/* ------------------------------------------------------------------------- */

/** Copy `[from, to)` from one descriptor to another through a reusable buffer. */
function copySpan(input, output, from, to, buffer) {
  let cursor = from;
  while (cursor < to) {
    const length = Math.min(buffer.length, to - cursor);
    const read = fs.readSync(input, buffer, 0, length, cursor);
    if (read === 0) throw new Error(`asar: short read copying ${cursor}..${to}`);
    let written = 0;
    while (written < read) written += fs.writeSync(output, buffer, written, read - written);
    cursor += read;
  }
}

/**
 * Write the patched archive to `destination`.
 *
 * Header arithmetic follows `lib/asar.cjs` exactly (and is asserted with the
 * same helper): `headerBufLen = 8 + jsonLen + padding`, `payloadSize =
 * headerBufLen - 4`, payloads start at `8 + headerBufLen`.
 * @param {string} source
 * @param {string} destination
 * @param {object} shape
 * @param {Map<string, string>} bodies
 * @returns {{size: number, entries: number, dataLength: number, contentOffset: number}}
 */
function writeArchive(source, destination, shape, bodies) {
  // Plan the new layout first: the header needs the offsets before it can be
  // serialized, and the data pass needs the same numbers.
  let cursor = 0;
  for (const item of shape.payloads) {
    item.newOffset = cursor;
    item.newSize = bodies.has(item.relative) ? Buffer.byteLength(bodies.get(item.relative), 'utf8') : item.size;
    cursor += item.newSize;
  }
  const dataLength = cursor;

  // Mutate the parsed tree in place. Assigning an existing key keeps its
  // position, so the header keeps the shipped key order; `integrity` is dropped
  // for the reason in the file header.
  for (const item of shape.all) {
    if (item.link === true) continue;
    const node = item.node;
    if (node.integrity !== undefined) delete node.integrity;
    if (item.unpacked === true) continue;
    node.offset = String(item.newOffset);
    node.size = item.newSize;
  }

  const json = Buffer.from(JSON.stringify(shape.header), 'utf8');
  const jsonLen = json.length;
  const padding = (4 - (jsonLen % 4)) % 4;
  const headerBufLen = 8 + jsonLen + padding;
  const payloadSize = headerBufLen - 4;
  const contentOffset = asar.assertPickle({ headerBufLen, payloadSize, jsonLen });
  if (contentOffset !== 16 + jsonLen + padding) throw new Error('asar: internal content offset mismatch');

  const prefix = Buffer.alloc(16);
  prefix.writeUInt32LE(4, 0);
  prefix.writeUInt32LE(headerBufLen, 4);
  prefix.writeUInt32LE(payloadSize, 8);
  prefix.writeUInt32LE(jsonLen, 12);

  const input = fs.openSync(source, 'r');
  const output = fs.openSync(destination, 'w');
  const buffer = Buffer.alloc(CHUNK);
  try {
    fs.writeSync(output, prefix);
    fs.writeSync(output, json);
    if (padding > 0) fs.writeSync(output, Buffer.alloc(padding));
    // Entry offsets are relative to the first payload byte, which sits after the
    // header Pickle — `base` is that absolute start.
    //
    // Only payload bytes are copied. The shipped archive is dense, but
    // `asar.createPackage` (what apply.cjs writes) pads every payload to 4 bytes,
    // and those gaps are *not* part of any entry: copying them would shift every
    // following payload away from the offset the header just declared. The new
    // layout is dense, so the padding is simply dropped.
    const base = shape.contentOffset;
    for (const item of shape.payloads) {
      const body = bodies.get(item.relative);
      if (body !== undefined) {
        const encoded = Buffer.from(body, 'utf8');
        let written = 0;
        while (written < encoded.length) written += fs.writeSync(output, encoded, written, encoded.length - written);
      } else if (item.size > 0) {
        copySpan(input, output, base + item.offset, base + item.offset + item.size, buffer);
      }
    }
    return { size: fs.fstatSync(output).size, entries: shape.payloads.length, dataLength, contentOffset };
  } finally {
    fs.closeSync(input);
    fs.closeSync(output);
  }
}

/* ------------------------------------------------------------------------- */
/* verification                                                               */
/* ------------------------------------------------------------------------- */

/**
 * Prove the staged archive before it is allowed to replace the installed one.
 *
 * Four independent questions: does the header parse under the same strict
 * reader Electron's format needs, does the byte count add up, do the patched
 * files read back exactly as intended, and are a spread of untouched entries
 * still byte-identical to the source.
 * @param {string} source
 * @param {string} staged
 * @param {object} shape
 * @param {Map<string, string>} bodies
 */
function verify(source, staged, shape, bodies) {
  const problems = [];
  const { contentOffset, size } = asar.readHeader(staged);
  const expectedSize = contentOffset + shape.payloads.reduce((total, item) => total + item.newSize, 0);
  if (size !== expectedSize) problems.push(`archive size ${size} !== expected ${expectedSize}`);

  const stagedFd = fs.openSync(staged, 'r');
  try {
    const byRelative = new Map(shape.payloads.map((item) => [item.relative, item]));
    for (const [file, text] of bodies) {
      const item = byRelative.get(file);
      if (item === undefined) { problems.push(`patched ${file} vanished from the staged header`); continue; }
      const actual = readRange(stagedFd, contentOffset + item.newOffset, item.newSize).toString('utf8');
      if (actual !== text) problems.push(`patched ${file} does not read back as written`);
    }

    const sourceFd = fs.openSync(source, 'r');
    try {
      const untouched = shape.payloads.filter((item) => !bodies.has(item.relative) && item.size > 0);
      const picks = new Set([0, untouched.length - 1]);
      for (let step = 1; step <= SPOT_CHECKS; step++) picks.add(Math.floor((untouched.length * step) / (SPOT_CHECKS + 1)));
      for (const index of picks) {
        const item = untouched[index];
        if (item === undefined) continue;
        const fromStaged = readRange(stagedFd, contentOffset + item.newOffset, item.newSize);
        const fromSource = readRange(sourceFd, shape.contentOffset + item.offset, item.size);
        if (!fromStaged.equals(fromSource)) problems.push(`untouched ${item.relative} changed`);
      }
    } finally {
      fs.closeSync(sourceFd);
    }
  } finally {
    fs.closeSync(stagedFd);
  }
  return problems;
}

/** `node --check` on the patched JavaScript, through a temp file. */
function syntaxCheck(bodies, directory) {
  const { spawnSync } = require('child_process');
  const results = [];
  for (const [file, text] of bodies) {
    if (!/\.(?:c|m)?js$/u.test(file)) continue;
    const scratch = path.join(directory, `check-${file.replace(/[\\/]/gu, '_')}`);
    fs.writeFileSync(scratch, text);
    const result = spawnSync(process.execPath, ['--check', scratch], { encoding: 'utf8' });
    try { fs.rmSync(scratch, { force: true }); } catch { /* a leftover temp file is harmless */ }
    if (result.error !== undefined) {
      // A spawn failure is not a syntax failure (sandboxes can refuse to spawn).
      results.push({ file, ok: true, warning: result.error.code ?? result.error.message });
      continue;
    }
    if (result.status !== 0) results.push({ file, ok: false, error: (result.stderr || result.stdout || '').trim() });
    else results.push({ file, ok: true });
  }
  return results;
}

/* ------------------------------------------------------------------------- */
/* entry point                                                                */
/* ------------------------------------------------------------------------- */

function parseArgs(argv) {
  const options = { app: undefined, check: false, json: false, quiet: false, backup: true, help: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--app') options.app = argv[++index];
    else if (arg === '--check' || arg === '-n') options.check = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--quiet' || arg === '-q') options.quiet = true;
    else if (arg === '--no-backup') options.backup = false;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

/**
 * Patch one installation, fast.
 * @param {string[]} [argv] - arguments after the script name
 * @returns {{state: string, action: string, app: string|null, ms: number, reason?: string, problems?: string[]}}
 */
function patch(argv = process.argv.slice(2)) {
  const options = typeof argv === 'string' ? parseArgs([argv]) : parseArgs(argv);
  const started = Date.now();
  const found = target.resolveApp({ explicit: options.app });
  const result = { state: 'unknown', action: 'none', app: found.app, ms: 0 };
  if (found.app === null) {
    result.state = 'unresolved';
    result.reason = found.reason ?? `looked in ${found.tried.length} place(s)`;
    result.ms = Date.now() - started;
    return result;
  }
  const probe = target.probeShell(found.app);
  result.state = probe.state;
  if (probe.state === 'current') { result.action = 'none'; result.ms = Date.now() - started; return result; }
  if (probe.state !== 'unpatched') {
    result.reason = `state is "${probe.state}"; fast.cjs only writes a stock shell (use auto.cjs --repair)`;
    result.ms = Date.now() - started;
    return result;
  }
  const archive = probe.archive;

  let header;
  let contentOffset;
  try {
    ({ header, contentOffset } = asar.readHeader(archive));
  } catch (error) {
    result.state = 'unreadable';
    result.reason = error && error.message ? error.message : String(error);
    result.ms = Date.now() - started;
    return result;
  }
  const shape = flatten(header, contentOffset);
  // Gaps between payloads are copied through untouched, so a 4-byte-aligned
  // archive (what `asar.createPackage` writes) is fine. An *overlap* is not:
  // that is a layout this writer cannot reproduce, so it hands over to apply.cjs.
  if (shape.overlap === true) {
    result.reason = 'the archive payloads overlap; use apply.cjs';
    result.ms = Date.now() - started;
    return result;
  }
  let bodies;
  try {
    bodies = patchBodies(archive, shape);
  } catch (error) {
    // A short read means the archive is being written right now (the installer).
    // Report it as unreadable so the sentinel retries instead of giving up.
    result.state = 'unreadable';
    result.reason = error && error.message ? error.message : String(error);
    result.ms = Date.now() - started;
    return result;
  }
  if (bodies === null) { result.state = 'current'; result.action = 'none'; result.ms = Date.now() - started; return result; }
  if (options.check) { result.action = 'would-apply'; result.ms = Date.now() - started; return result; }
  let backupPath = `${archive}${BACKUP_SUFFIX}`;
  let backupLinked = false;
  if (options.backup) {
    // Keep revert.cjs honest: the backup must be a *stock* archive of the shell
    // version that is installed right now, not one left over from an older
    // build, so it is refreshed on every patch. A hard link makes that free: the
    // commit below *renames* a staged archive over app.asar, so the link keeps
    // pointing at the untouched inode instead of a 170 MiB copy on the critical
    // path. The in-place fallback turns it back into a real copy first.
    try { fs.rmSync(backupPath, { force: true }); } catch { /* recreated below */ }
    try {
      fs.linkSync(archive, backupPath);
      backupLinked = true;
    } catch {
      try { fs.copyFileSync(archive, backupPath); } catch (error) {
        result.reason = `could not refresh ${backupPath} (${error.code ?? error.message}); refusing to patch without a recovery copy`;
        result.ms = Date.now() - started;
        return result;
      }
    }
  }

  const staged = `${archive}${STAGING_SUFFIX}`;
  try { fs.rmSync(staged, { force: true }); } catch { /* it is overwritten anyway */ }
  const written = writeArchive(archive, staged, shape, bodies);
  const problems = verify(archive, staged, shape, bodies);
  const syntax = syntaxCheck(bodies, path.dirname(staged));
  for (const check of syntax) if (!check.ok) problems.push(`patched ${check.file} no longer parses:\n${check.error}`);
  if (problems.length > 0) {
    try { fs.rmSync(staged, { force: true }); } catch { /* keep the failure readable */ }
    result.action = 'refused';
    result.problems = problems;
    result.reason = problems[0];
    result.ms = Date.now() - started;
    return result;
  }

  try {
    fs.renameSync(staged, archive);
    result.action = 'apply';
  } catch (error) {
    if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code)) throw error;
    // A running shell (or an installer) holds the file open. Rewriting in place
    // is allowed and leaves the file identity alone; the staged copy is the
    // verified one either way. The recovery copy is a hard link to this very
    // inode, so it must be materialized before the rewrite or it would be
    // destroyed along with the original.
    if (backupLinked) {
      try { fs.rmSync(backupPath, { force: true }); } catch { /* best effort */ }
      try { fs.copyFileSync(archive, backupPath); } catch { /* recovery copy is best effort here */ }
    }
    fs.writeFileSync(archive, fs.readFileSync(staged));
    try { fs.rmSync(staged, { force: true }); } catch { /* leave it */ }
    result.action = 'apply-in-place';
  }
  const after = target.probeShell(found.app);
  result.state = after.state;
  result.bytes = written.size;
  result.ms = Date.now() - started;
  return result;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]);
    return 0;
  }
  const result = patch(argv);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } else if (!options.quiet) {
    const label = { current: 'PATCHED', unpatched: 'STOCK', stale: 'STALE', mixed: 'PARTIAL', unreadable: 'UNKNOWN' }[result.state] ?? result.state;
    console.log(`[fast] ${label} ${result.app ?? ''} -> ${result.action} in ${result.ms} ms${result.reason ? ` (${result.reason})` : ''}`);
  }
  if (result.action === 'apply' || result.action === 'apply-in-place') return 0;
  if (result.state === 'current') return 0;
  return 1;
}

module.exports = { patch, main, flatten, writeArchive, verify, patchBodies, BACKUP_SUFFIX, STAGING_SUFFIX };

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error('\n[fast] FAILED');
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  }
}
