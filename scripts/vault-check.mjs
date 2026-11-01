#!/usr/bin/env node
// vault-check — deterministic Obsidian vault connection check (constitution rule 3: no AI judgment).
//
// Answers, every session, without anyone having to eyeball it:
//   1. Is the vault actually registered with Obsidian? (.obsidian/ at the repo root)
//   2. Are the strategy notes there, and how many?
//   3. Rule 11 — does every note carry at least one [[wikilink]], or are there orphan islands?
//   4. Rule 12 — is the vault TRAILING brain/facts.md? (facts written after the newest note)
//   5. Is any of it uncommitted?
//
// Usage:  node scripts/vault-check.mjs [--json]
// Exit:   0 = connected and clean, 1 = connected with problems, 2 = not connected.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VAULT_CONFIG = path.join(ROOT, '.obsidian');
const STRATEGY_DIR = path.join(ROOT, 'strategy');
const FACTS = path.join(ROOT, 'brain', 'facts.md');

const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

function read(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

// --- 1. vault registered ----------------------------------------------------
const registered = fs.existsSync(VAULT_CONFIG) && fs.statSync(VAULT_CONFIG).isDirectory();

// --- 2 & 3. notes and orphans ----------------------------------------------
let notes = [];
if (fs.existsSync(STRATEGY_DIR)) {
  notes = fs.readdirSync(STRATEGY_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const full = path.join(STRATEGY_DIR, f);
      const body = read(full);
      return {
        name: f.replace(/\.md$/, ''),
        mtime: fs.statSync(full).mtimeMs,
        linked: /\[\[[^\]]+\]\]/.test(body),
      };
    });
}
const orphans = notes.filter((n) => !n.linked).map((n) => n.name);
const newestNote = notes.reduce((a, n) => (n.mtime > a ? n.mtime : a), 0);

// --- 4. vault trailing facts.md? -------------------------------------------
// facts.md entries look like:  - [2026-07-31] (something)
const factDates = [...read(FACTS).matchAll(/^- \[(\d{4}-\d{2}-\d{2})\]/gm)].map((m) => m[1]).sort();
const factsLatest = factDates.length ? factDates[factDates.length - 1] : null;
const notesLatest = newestNote ? dayOf(newestNote) : null;
const trailing = Boolean(factsLatest && notesLatest && notesLatest < factsLatest);

// --- 5. uncommitted ---------------------------------------------------------
let dirty = [];
try {
  const out = execFileSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
  dirty = out.split('\n').map((l) => l.trim()).filter(Boolean);
} catch { /* not a git repo / git unavailable — leave empty */ }

const vaultDirty = dirty.filter((l) => /\bstrategy\/|brain\/facts\.md/.test(l));

// --- verdict ----------------------------------------------------------------
const problems = [];
if (!registered) problems.push('vault not registered with Obsidian (no .obsidian/ at repo root)');
if (!notes.length) problems.push('no notes found in strategy/');
if (orphans.length) problems.push(`${orphans.length} orphan note(s) with no wikilink: ${orphans.join(', ')}`);
if (trailing) problems.push(`vault trails facts.md — newest fact ${factsLatest}, newest note ${notesLatest}`);
if (vaultDirty.length) problems.push(`${vaultDirty.length} uncommitted vault/facts change(s)`);

const status = !registered ? 'disconnected' : problems.length ? 'attention' : 'connected';

const result = {
  status,
  registered,
  noteCount: notes.length,
  orphans,
  factsLatest,
  notesLatest,
  trailing,
  uncommitted: vaultDirty.length,
  problems,
  headline:
    status === 'disconnected' ? 'Obsidian vault NOT connected'
    : status === 'connected' ? `Obsidian vault connected — ${notes.length} notes, in sync`
    : `Obsidian vault connected — ${notes.length} notes, ${problems.length} thing(s) to fix`,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(result.headline);
  for (const p of problems) console.log('  - ' + p);
}

process.exit(status === 'disconnected' ? 2 : problems.length ? 1 : 0);
