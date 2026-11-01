// Encourt command deck — Jarvis backend
// Node 18+ ESM Express server. Binds 127.0.0.1 only.

import path from 'node:path';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';
import dotenv from 'dotenv';
import { query } from '@anthropic-ai/claude-agent-sdk';

// ---------------------------------------------------------------------------
// Paths & config
// ---------------------------------------------------------------------------
const JARVIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(JARVIS_DIR, '..');
const DECK_STATE_PATH = path.join(JARVIS_DIR, 'deck-state.json');
const SESSION_FILE = path.join(JARVIS_DIR, '.session');
const PUBLIC_DIR = path.join(JARVIS_DIR, 'public');
const SKILLS_DIR = path.join(PROJECT_ROOT, '.claude', 'skills');
const BRIEFS_DIR = path.join(PROJECT_ROOT, 'reports', 'briefs');

dotenv.config({ path: path.join(JARVIS_DIR, '.env') });

const PORT = process.env.PORT || 4870;
const HOST = '127.0.0.1';

const DECK_PERSONA = `You are Jarvis, the voice and intelligence of Krish's Encourt command deck; address Krish as "sir" now and then, naturally. He usually speaks by voice and often runs several tasks at once.

Reply protocol (strict):
1) While working, between tool calls, emit one-line progress notes (plain text, under 25 words; make the FIRST one under 6 words) so the deck can narrate what you are doing.
2) End every substantive reply with the full written brief for the screen, then — when ONE number or one small comparison is the heart of the answer — a line containing exactly ===GLASS=== followed by "key: value" lines that the deck renders as a cinematic etched-glass overlay ("putting it on the glass"): title (short caps window name), kicker (one caps line above the number), then EITHER hero (the one big figure, e.g. £30.5k) with optional unit (small caps line under it, e.g. A WEEK), OR bars (2-6 items: Label £value | Label £value | ...), then sub (one short lowercase sentence), footer (source + date, lowercase). Mention the glass naturally in the spoken bullets ("it's on the glass now, sir"). Then a line containing exactly ===SPEAK=== followed by 2-5 "- " bullet lines in plain spoken English (these are read aloud), then a line containing exactly ===NEXT=== followed by 1-4 "- " lines of concrete suggested next actions phrased as commands Krish could give (e.g. "- Run the member-census skill — lock the July milestone score"), then — only when the task created or updated files Krish should see (PDFs, briefs, sheets, notes) — a line containing exactly ===FILES=== followed by one "- " line per file in the form "- <repo-relative-path> — <short description>". Skip ===GLASS=== when no single figure carries the answer; skip ===NEXT=== only when nothing sensible follows; skip ===FILES=== when there are no deliverables. Trivial acknowledgements may skip all sentinels.
3) The on-screen brief uses clean simple markdown: short "## " headings where helpful, "- " bullets, numbered lists, **bold** for key numbers, and repo-relative file paths written plainly (e.g. reports/briefs/x.pdf) — the deck renders them as clickable links.
4) When there is a deliverable, mention it naturally in the spoken bullets ("The PDF is on your screen now, sir — I can open it or show it in Finder.").

When club numbers change, update jarvis/deck-state.json. Follow CLAUDE.md.`;

// Cadence lookup — not stored in frontmatter. command-deck is skipped entirely.
const SKILL_CADENCE = {
  'revenue-kpi-review': 'weekly-ish',
  'member-census': 'month-end',
  'churn-conversion-monitor': 'weekly-ish',
  'lapsed-winback-call-sheet': 'on demand',
  'purep2p-desk-sheet': 'on demand',
  'teamup-pilates-pull': 'weekly-ish',
  'occupancy-drop-diagnosis': 'when red',
  'playtomic-live-pull': 'plumbing',
  'competitor-social-refresh': 'fortnightly-ish',
  'xero-cost-actuals': 'month-end',
  'vault-sync': 'close-out',
};

const ts = () => new Date().toISOString();
const log = (...args) => console.log(`[${ts()}]`, ...args);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pull "description:" out of SKILL.md YAML frontmatter; first sentence, ~90 chars max. */
function skillDescription(skillMd) {
  const fm = skillMd.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return '';
  const descLine = fm[1].match(/^description:\s*(.+)$/m);
  if (!descLine) return '';
  let desc = descLine[1].trim().replace(/^["']|["']$/g, '');
  // First sentence: cut at the first ". " boundary.
  const sentence = desc.match(/^.*?[.!?](?=\s|$)/);
  if (sentence) desc = sentence[0];
  if (desc.length > 90) desc = desc.slice(0, 87).trimEnd() + '...';
  return desc;
}

async function scanSkills() {
  const skills = [];
  let entries = [];
  try {
    entries = await fsp.readdir(SKILLS_DIR, { withFileTypes: true });
  } catch {
    return skills;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (name === 'command-deck') continue; // the deck itself — skip
    const skillFile = path.join(SKILLS_DIR, name, 'SKILL.md');
    let desc = '';
    try {
      desc = skillDescription(await fsp.readFile(skillFile, 'utf8'));
    } catch {
      continue; // no SKILL.md — not a skill
    }
    skills.push({ name, desc, cadence: SKILL_CADENCE[name] || 'on demand' });
  }
  skills.sort((a, b) => a.name.localeCompare(b.name));
  return skills;
}

async function newestBriefs(limit = 8) {
  let entries = [];
  try {
    entries = await fsp.readdir(BRIEFS_DIR);
  } catch {
    return [];
  }
  const briefs = [];
  for (const file of entries) {
    if (!/\.(md|pdf)$/i.test(file)) continue;
    try {
      const stat = await fsp.stat(path.join(BRIEFS_DIR, file));
      if (stat.isFile()) briefs.push({ file, mtime: stat.mtime.toISOString() });
    } catch {
      /* skip unreadable */
    }
  }
  briefs.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
  const top = briefs.slice(0, limit);
  // First heading of each .md as a one-line preview for the docked chips.
  await Promise.all(top.map(async (b) => {
    if (!/\.md$/i.test(b.file)) return;
    try {
      const fh = await fsp.open(path.join(BRIEFS_DIR, b.file), 'r');
      const { buffer, bytesRead } = await fh.read(Buffer.alloc(600), 0, 600, 0);
      await fh.close();
      const m = buffer.slice(0, bytesRead).toString('utf8').match(/^#{1,3}\s+(.{4,90})/m);
      if (m) b.head = m[1].trim();
    } catch { /* preview is optional */ }
  }));
  return top;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// --- health ---------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// --- obsidian vault check -------------------------------------------------
// Deterministic (scripts/vault-check.mjs). Runs on every deck open so the vault
// link is verified every session rather than assumed — constitution rules 11 & 12.
const VAULT_CHECK = path.join(PROJECT_ROOT, 'scripts', 'vault-check.mjs');

function vaultStatus() {
  return new Promise((resolve) => {
    execFile(process.execPath, [VAULT_CHECK, '--json'], { cwd: PROJECT_ROOT, timeout: 10000 },
      (err, stdout) => {
        // The script exits 1 (attention) / 2 (disconnected) by design — stdout is still valid JSON.
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          resolve({
            status: 'unknown',
            headline: 'vault check failed to run',
            problems: [String((err && err.message) || e)],
            orphans: [], noteCount: 0,
          });
        }
      });
  });
}

app.get('/api/vault', async (_req, res) => res.json(await vaultStatus()));

// --- deck -----------------------------------------------------------------
app.get('/api/deck', async (_req, res) => {
  try {
    // Read fresh every request — no caching.
    const raw = await fsp.readFile(DECK_STATE_PATH, 'utf8');
    const state = JSON.parse(raw);
    const [skills, briefs, vault] = await Promise.all([scanSkills(), newestBriefs(8), vaultStatus()]);
    res.json({
      date: state.updated || new Date().toISOString().slice(0, 10),
      statusLine: state.statusLine || '',
      briefing: state.briefing || '',
      tiles: state.tiles || [],
      alerts: state.alerts || [],
      skills,
      briefs,
      vault,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// --- working-view narration ------------------------------------------------
// Turns a raw tool call into (a) a short target for the on-screen work log and
// (b) a plain spoken sentence, so the deck never goes silent or blank mid-task.
const shortPath = (p) => String(p || '').replace(PROJECT_ROOT + '/', '').replace(/^\/+/, '');

function toolDetail(name, input) {
  if (!input || typeof input !== 'object') return '';
  const first = (...keys) => { for (const k of keys) if (input[k]) return String(input[k]); return ''; };
  switch (name) {
    case 'Read': case 'Write': case 'Edit': case 'NotebookEdit':
      return shortPath(first('file_path', 'notebook_path'));
    case 'Bash':
      return first('description') || first('command').slice(0, 90);
    case 'Grep':
      return first('pattern') + (input.path ? ' in ' + shortPath(input.path) : '');
    case 'Glob':
      return first('pattern');
    case 'Skill':
      return first('skill');
    case 'WebFetch': case 'WebSearch':
      return first('url', 'query');
    case 'Task': case 'Agent':
      return first('description');
    default:
      return first('description', 'file_path', 'pattern', 'query', 'skill');
  }
}

function describeStep(name, detail) {
  const d = detail || '';
  switch (name) {
    case 'Read':   return d ? `Reading ${path.basename(d)}` : 'Reading a file';
    case 'Write':  return d ? `Writing ${path.basename(d)}` : 'Writing a file';
    case 'Edit': case 'NotebookEdit': return d ? `Editing ${path.basename(d)}` : 'Editing a file';
    case 'Bash':   return d ? `Running: ${d}` : 'Running a command';
    case 'Grep': case 'Glob': return d ? `Searching for ${d}` : 'Searching the project';
    case 'Skill':  return d ? `Running the ${d} skill` : 'Running a skill';
    case 'WebFetch': case 'WebSearch': return d ? `Looking up ${d}` : 'Searching the web';
    case 'Task': case 'Agent': return d ? `Delegating: ${d}` : 'Delegating a sub-task';
    default:       return d ? `${name} — ${d}` : `Using ${name}`;
  }
}

// --- task manager ----------------------------------------------------------
// Tasks outlive their originating HTTP request. Each task keeps a ring buffer of
// SSE events; any number of streams (waiters) can attach, get a replay, then live
// events. Client disconnects never interrupt a task — that is the whole point.
const tasks = new Map();
const EVENT_CAP = 600;
const MAX_RUNNING = 3;

function newTaskId() {
  for (;;) {
    const id = Math.random().toString(36).slice(2, 8).padEnd(6, '0');
    if (!tasks.has(id)) return id;
  }
}

function createTask(message) {
  const task = {
    id: newTaskId(),
    title: message.replace(/\s+/g, ' ').trim().slice(0, 60),
    status: 'running',
    createdAt: ts(),
    sdkSessionId: null,
    events: [],
    waiters: new Set(),
    q: null,
  };
  tasks.set(task.id, task);
  return task;
}

function runningCount(except) {
  let n = 0;
  for (const t of tasks.values()) if (t.status === 'running' && t !== except) n++;
  return n;
}

function sseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (res.flushHeaders) res.flushHeaders();
}

const sseWrite = (res, obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

/** Record an event on the task and fan it out to every attached stream. */
function emit(task, obj) {
  task.events.push(obj);
  if (task.events.length > EVENT_CAP) task.events.shift();
  for (const waiter of task.waiters) {
    try {
      sseWrite(waiter, obj);
    } catch {
      task.waiters.delete(waiter);
    }
  }
}

/** Attach an SSE response to a task: replay history, then live events. */
function attachWaiter(task, res) {
  sseWrite(res, { type: 'task', id: task.id, title: task.title });
  for (const ev of task.events) sseWrite(res, ev);
  if (task.status !== 'running') {
    res.end();
    return;
  }
  task.waiters.add(res);
  // res 'close' with writableEnded=false means the CLIENT disconnected mid-stream.
  // Just detach — the task keeps running without any watchers.
  res.on('close', () => {
    if (!res.writableEnded) task.waiters.delete(res);
  });
}

/** Fire-and-forget: drive one SDK turn for this task, emitting events as it goes. */
async function runTask(task, message, resumeSessionId) {
  log(`task ${task.id} start:`, task.title);
  try {
    const q = query({
      prompt: message,
      options: {
        cwd: PROJECT_ROOT,
        permissionMode: 'bypassPermissions',
        settingSources: ['user', 'project', 'local'],
        systemPrompt: { type: 'preset', preset: 'claude_code', append: DECK_PERSONA },
        model: process.env.JARVIS_MODEL || 'claude-fable-5',
        ...(resumeSessionId ? { resume: resumeSessionId } : {}),
      },
    });
    task.q = q;

    for await (const msg of q) {
      if (msg.type === 'system' && msg.session_id && msg.session_id !== task.sdkSessionId) {
        task.sdkSessionId = msg.session_id;
        emit(task, { type: 'session', id: msg.session_id });
      }

      if (msg.type === 'assistant') {
        const blocks = msg.message?.content ?? msg.content ?? [];
        if (Array.isArray(blocks)) {
          for (const block of blocks) {
            if (block.type === 'text' && block.text) {
              emit(task, { type: 'text', text: block.text });
            } else if (block.type === 'tool_use') {
              const detail = toolDetail(block.name, block.input);
              log(`task ${task.id} tool use:`, block.name, detail);
              emit(task, { type: 'tool', name: block.name, detail, step: describeStep(block.name, detail) });
            }
          }
        }
      }

      if (msg.type === 'result' && task.status === 'running') {
        task.status = 'done';
        emit(task, { type: 'status', status: 'done' });
      }
    }
  } catch (e) {
    log(`task ${task.id} error:`, String(e));
    if (task.status === 'running') {
      task.status = 'error';
      emit(task, { type: 'error', error: String(e) });
      emit(task, { type: 'status', status: 'error' });
    }
  } finally {
    task.q = null;
    // Stopped mid-flight without a result message — still terminal.
    if (task.status === 'running') {
      task.status = 'done';
      emit(task, { type: 'status', status: 'done' });
    }
    for (const waiter of task.waiters) {
      try {
        waiter.end();
      } catch {
        /* already gone */
      }
    }
    task.waiters.clear();
    log(`task ${task.id} finished: ${task.status}`);
  }
}

// --- chat (SSE) -----------------------------------------------------------
app.post('/api/chat', (req, res) => {
  sseHeaders(res);

  const message = req.body && typeof req.body.message === 'string' ? req.body.message : '';
  if (!message.trim()) {
    sseWrite(res, { type: 'error', error: 'empty message' });
    res.end();
    return;
  }

  const taskId = req.body && typeof req.body.taskId === 'string' ? req.body.taskId : '';
  const existing = taskId && tasks.has(taskId) ? tasks.get(taskId) : null;

  if (runningCount(existing) >= MAX_RUNNING) {
    sseWrite(res, { type: 'error', error: 'deck at capacity — three tasks already running' });
    res.end();
    return;
  }

  let task;
  if (existing) {
    // Follow-up: same task, resumed SDK session.
    task = existing;
    task.status = 'running';
    log(`task ${task.id} follow-up:`, message);
  } else {
    task = createTask(message);
  }

  attachWaiter(task, res);
  runTask(task, message, existing ? task.sdkSessionId : null);
});

// --- tasks ----------------------------------------------------------------
app.get('/api/tasks', (_req, res) => {
  const list = [...tasks.values()]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((t) => {
      let lastStep = '';
      for (let i = t.events.length - 1; i >= 0; i--) {
        if (t.events[i].type === 'tool') {
          lastStep = t.events[i].step || '';
          break;
        }
      }
      return { id: t.id, title: t.title, status: t.status, createdAt: t.createdAt, lastStep };
    });
  res.json({ tasks: list });
});

app.get('/api/tasks/:id/stream', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'unknown task' });
    return;
  }
  sseHeaders(res);
  attachWaiter(task, res);
});

app.post('/api/tasks/:id/stop', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'unknown task' });
    return;
  }
  if (task.q && typeof task.q.interrupt === 'function') {
    try {
      const p = task.q.interrupt();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* already stopped */
    }
  }
  task.status = 'stopped';
  emit(task, { type: 'status', status: 'stopped' });
  log(`task ${task.id} stopped`);
  res.json({ ok: true });
});

// --- new chat -------------------------------------------------------------
app.post('/api/chat/new', async (_req, res) => {
  let cleared = 0;
  for (const [id, t] of tasks) {
    if (t.status !== 'running') {
      tasks.delete(id);
      cleared++;
    }
  }
  try {
    await fsp.unlink(SESSION_FILE); // legacy single-session file
  } catch {
    /* no session file — fine */
  }
  log(`cleared ${cleared} finished task(s)`);
  res.json({ ok: true });
});

// --- tts ------------------------------------------------------------------
// Short phrases (acks, murmurs, repeated lines) are cached to disk after the first
// render, so the second time they play with zero ElevenLabs round-trip.
const TTS_CACHE_DIR = path.join(JARVIS_DIR, '.tts-cache');
const TTS_MODEL = 'eleven_turbo_v2_5';
const TTS_CACHE_MAX_CHARS = 600;

app.post('/api/tts', async (req, res) => {
  const text = req.body && typeof req.body.text === 'string' ? req.body.text : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'empty text' });
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (apiKey && voiceId) {
    const cacheable = text.length <= TTS_CACHE_MAX_CHARS;
    const cachePath = path.join(
      TTS_CACHE_DIR,
      crypto.createHash('sha1').update(`${voiceId}|${TTS_MODEL}|${text}`).digest('hex') + '.mp3'
    );
    if (cacheable) {
      try {
        await fsp.access(cachePath);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.sendFile(cachePath, (err) => {
          if (!err) return;
          if (!res.headersSent) res.status(500).end();
          else res.destroy();   // never leave the client's blob() hanging on a half-sent file
        });
        return;
      } catch { /* not cached yet */ }
    }
    try {
      const upstream = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, model_id: TTS_MODEL }),
        }
      );
      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => '');
        res.status(502).json({ error: `elevenlabs ${upstream.status}`, detail });
        return;
      }
      res.setHeader('Content-Type', 'audio/mpeg');
      // Pipe the mp3 back, buffering a copy for the cache.
      const chunks = [];
      const reader = upstream.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const buf = Buffer.from(value);
        if (cacheable) chunks.push(buf);
        res.write(buf);
      }
      res.end();
      if (cacheable && chunks.length) {
        // temp-file + atomic rename: readers can never observe a half-written mp3,
        // and a crash mid-write can't leave a corrupt entry behind.
        const tmpPath = cachePath + '.' + process.pid + '-' + Math.random().toString(36).slice(2) + '.tmp';
        fsp.mkdir(TTS_CACHE_DIR, { recursive: true })
          .then(() => fsp.writeFile(tmpPath, Buffer.concat(chunks)))
          .then(() => fsp.rename(tmpPath, cachePath))
          .catch((e) => { log('tts cache write failed:', String(e)); fsp.unlink(tmpPath).catch(() => {}); });
      }
    } catch (e) {
      log('tts error:', String(e));
      if (!res.headersSent) res.status(500).json({ error: String(e) });
      else res.end();
    }
  } else {
    // Local macOS fallback — args array, never shell interpolation.
    execFile('say', ['-v', 'Daniel', '-r', '172', text], (err) => {
      if (err) {
        log('say error:', String(err));
        res.status(500).json({ error: String(err) });
      } else {
        res.json({ local: true });
      }
    });
  }
});

// --- briefs ---------------------------------------------------------------
app.get('/api/briefs/:file', (req, res) => {
  const safe = path.basename(req.params.file);
  const filePath = path.join(BRIEFS_DIR, safe);
  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      res.status(err.status || 404).json({ error: 'not found' });
    }
  });
});

// --- project files (artifact cards) ---------------------------------------
// Both endpoints take repo-relative paths and are hard-sandboxed to PROJECT_ROOT:
// resolve first, then require the resolved path to sit inside the root.
function resolveInRoot(p) {
  if (typeof p !== 'string' || !p.trim()) return null;
  const abs = path.resolve(PROJECT_ROOT, p);
  return abs.startsWith(PROJECT_ROOT + path.sep) ? abs : null;
}

const FILE_TYPES = {
  '.pdf': { type: 'application/pdf', disposition: 'inline' },
  '.md': { type: 'text/plain; charset=utf-8', disposition: 'inline' },
  '.txt': { type: 'text/plain; charset=utf-8', disposition: 'inline' },
  '.csv': { type: 'text/csv', disposition: 'inline' },
  '.json': { type: 'application/json', disposition: 'inline' },
  '.png': { type: 'image/png', disposition: 'inline' },
  '.jpg': { type: 'image/jpeg', disposition: 'inline' },
  '.jpeg': { type: 'image/jpeg', disposition: 'inline' },
  '.xlsx': { type: 'application/octet-stream', disposition: 'attachment' },
};

app.get('/api/file', async (req, res) => {
  const abs = resolveInRoot(req.query.p);
  if (!abs) {
    res.status(403).json({ error: 'path outside project root' });
    return;
  }
  let stat;
  try {
    stat = await fsp.stat(abs);
  } catch {
    res.status(404).json({ error: 'not found' });
    return;
  }
  if (!stat.isFile()) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const ext = path.extname(abs).toLowerCase();
  const meta = FILE_TYPES[ext] || { type: 'application/octet-stream', disposition: 'attachment' };
  const fname = path.basename(abs).replace(/"/g, '');
  res.sendFile(abs, {
    headers: {
      'Content-Type': meta.type,
      'Content-Disposition': `${meta.disposition}; filename="${fname}"`,
    },
  }, (err) => {
    if (err && !res.headersSent) {
      res.status(err.status || 404).json({ error: 'not found' });
    }
  });
});

app.post('/api/reveal', async (req, res) => {
  const abs = resolveInRoot(req.body && req.body.path);
  if (!abs) {
    res.status(403).json({ error: 'path outside project root' });
    return;
  }
  try {
    const stat = await fsp.stat(abs);
    if (!stat.isFile() && !stat.isDirectory()) throw new Error('not a file');
  } catch {
    res.status(404).json({ error: 'not found' });
    return;
  }
  execFile('open', ['-R', abs], (err) => {
    if (err) {
      log('reveal error:', String(err));
      res.status(500).json({ error: String(err) });
    } else {
      res.json({ ok: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, HOST, () => {
  const eleven = process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID;
  log(`Encourt command deck at http://${HOST}:${PORT}`);
  log(`ElevenLabs TTS: ${eleven ? 'configured' : 'not configured — falling back to macOS say'}`);
});
