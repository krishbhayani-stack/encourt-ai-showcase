// matchmaker/daemon.js — entry point for the 24/7 poll loop.
//   node daemon.js          → run forever (jittered poll interval)
//   node daemon.js --once   → run a single tick and exit (manual / cron-style)
// PILOT mode by default (fail-closed): detects + queues proposals, sends NOTHING.
import { loadEnv } from './lib/env.js';
import { Store } from './lib/tokenstore.js';
import { PlaytomicClient } from './lib/playtomic.js';
import { Ledger } from './lib/ledger.js';
import { Daemon } from './lib/daemon.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = dirname(fileURLToPath(import.meta.url));
const env = loadEnv(join(DIR, '.env'));
const store = new Store(DIR);
const rules = JSON.parse(readFileSync(join(DIR, 'rules.json'), 'utf8'));
const ledger = new Ledger(join(DIR, 'ledger.jsonl'));
const client = new PlaytomicClient({ store, env, log: () => {} });
const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

let release;
try { release = store.acquireLock(); }
catch (e) { console.error('✗ ' + e.message + ' — refusing to start a second instance.'); process.exit(1); }

const daemon = new Daemon({ client, store, ledger, rules, dir: DIR, log });

const cleanup = () => { try { if (release) release(); } catch {} };
const shutdown = (sig) => { log(`${sig} received — stopping`); daemon.stop(); cleanup(); process.exit(0); };
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('exit', cleanup);

if (process.argv.includes('--once')) {
  daemon.tick().then(r => { log('once: ' + JSON.stringify(r)); cleanup(); process.exit(0); })
    .catch(e => { log('once error: ' + e.message); cleanup(); process.exit(1); });
} else {
  daemon.run().catch(e => { log('fatal: ' + e.message); cleanup(); process.exit(1); });
}
