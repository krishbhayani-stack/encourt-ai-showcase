// matchmaker/server.js — standalone dashboard for the matchmaker daemon (own port, NOT jarvis).
// Zero deps (node:http). Binds 127.0.0.1 only. Reads the daemon's queue.json / state.json /
// rules.json / ledger and exposes controls: PILOT/AUTO toggle, kill switch, approve/dismiss.
// Sending is still disabled in the daemon, so "approve" is recorded for the future writer only.
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Store } from './lib/tokenstore.js';
import { Ledger } from './lib/ledger.js';
import { loadEnv } from './lib/env.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const env = loadEnv(join(DIR, '.env'));
const PORT = Number(env.PORT) || 4880;
const store = new Store(DIR);
const ledger = new Ledger(join(DIR, 'ledger.jsonl'));
const rules = readJson(join(DIR, 'rules.json')) || {};
const KILL = join(DIR, 'KILL');

function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }
function send(res, code, body, type = 'application/json') { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); }
function readBody(req) { return new Promise(r => { let d = ''; req.on('data', c => { d += c; if (d.length > 1e5) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(d || '{}')); } catch { r({}); } }); }); }

function snapshot() {
  const state = store.loadState();
  const now = Date.now();
  // pending computed LIVE from the ledger (reflects approve/dismiss immediately), not the
  // daemon's periodic queue.json snapshot.
  const cooldownMs = (rules.proposalCooldownHours || 6) * 3600 * 1000;
  const startMs = (iso) => Date.parse(/[zZ]$|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + 'Z');
  // ACTIONABLE ONLY: hide proposals whose target game has already started — you can't act on a
  // game that's begun. A proposal auto-disappears the moment its booking time passes.
  const pending = ledger.pending(cooldownMs, now).filter(p => p.target?.start_date && startMs(p.target.start_date) > now);
  const lastPoll = state.lastGoodPollAt || null;
  const pollAgeSec = lastPoll ? Math.round((now - lastPoll) / 1000) : null;
  const staleAfter = (rules.pollIntervalSec || 600) * 3;
  return {
    mode: state.mode, authDead: state.authDead === true, authDeadReason: state.raw?.authDeadReason || null,
    killed: existsSync(KILL),
    lastPollAt: lastPoll ? new Date(lastPoll).toISOString() : null, pollAgeSec,
    daemonHealth: lastPoll == null ? 'never-run' : (pollAgeSec > staleAfter ? 'STALE' : 'ok'),
    lastAlert: state.raw?.lastAlert || null, lastTick: state.raw?.lastTick || null,
    rules: { windowMin: rules.windowMin, levelRule: rules.levelRule, pollIntervalSec: rules.pollIntervalSec, quietHours: rules.quietHours },
    writerEnabled: false,   // hard fact this phase
    pending,
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, readFileSync(join(DIR, 'public', 'index.html'), 'utf8'), 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, snapshot());

    if (req.method === 'POST' && url.pathname === '/api/mode') {
      const { mode } = await readBody(req);
      if (mode !== 'PILOT' && mode !== 'AUTO') return send(res, 400, { error: 'mode must be PILOT or AUTO' });
      store.saveState({ mode, modeSetAt: Date.now() });
      return send(res, 200, { ok: true, mode, note: mode === 'AUTO' ? 'AUTO set — but the daemon still cannot send until the writer is built.' : 'PILOT' });
    }
    if (req.method === 'POST' && url.pathname === '/api/kill') {
      const { engaged } = await readBody(req);
      if (engaged) writeFileSync(KILL, new Date().toISOString());
      else if (existsSync(KILL)) unlinkSync(KILL);
      return send(res, 200, { ok: true, killed: existsSync(KILL) });
    }
    if (req.method === 'POST' && url.pathname === '/api/resolve') {
      const { proposalId, resolution } = await readBody(req);
      if (!/^[a-f0-9]{8,32}$/.test(String(proposalId || ''))) return send(res, 400, { error: 'bad proposalId' });
      if (resolution !== 'approved' && resolution !== 'dismissed') return send(res, 400, { error: 'bad resolution' });
      ledger.append({ type: 'resolve', atMs: Date.now(), at: new Date().toISOString(), proposalId, resolution, via: 'dashboard' });
      return send(res, 200, { ok: true });
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) { return send(res, 500, { error: e.message }); }
});

server.listen(PORT, '127.0.0.1', () => console.log(`▸ Matchmaker dashboard → http://127.0.0.1:${PORT}  (binds localhost only)`));
