// matchmaker/lib/tokenstore.js
// Durable state for the daemon: token cache, run-state (AUTH_DEAD latch, live URLs, mode),
// and a cross-process single-instance lock. All writes are atomic (tmp -> fsync -> rename) and
// chmod 600 (files hold secrets / PII). Implements the red-team must-fixes about persistence.
import {
  openSync, writeSync, fsyncSync, closeSync, renameSync, readFileSync,
  chmodSync, unlinkSync, existsSync,
} from 'node:fs';
import { join } from 'node:path';

const TOKENS = '.tokens.json';
const STATE = 'state.json';
const LOCK = '.daemon.lock';

function atomicWriteJson(path, obj) {
  const tmp = path + '.tmp';
  const fd = openSync(tmp, 'w', 0o600);
  try {
    writeSync(fd, JSON.stringify(obj, null, 1));
    fsyncSync(fd);
  } finally { closeSync(fd); }
  chmodSync(tmp, 0o600);
  renameSync(tmp, path);   // atomic on POSIX
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return null; }
}

export class Store {
  constructor(dir) { this.dir = dir; }
  _p(f) { return join(this.dir, f); }

  loadTokens() { return readJson(this._p(TOKENS)); }
  saveTokens(t) { atomicWriteJson(this._p(TOKENS), t); }

  // state.json holds run-state. Defaults FAIL CLOSED: mode defaults to 'PILOT' (never AUTO),
  // authDead defaults false but is a hard latch once set.
  loadState() {
    const s = readJson(this._p(STATE)) || {};
    return {
      authDead: s.authDead === true,
      loginFailCount: Number.isInteger(s.loginFailCount) ? s.loginFailCount : 0,
      liveLoginUrl: typeof s.liveLoginUrl === 'string' ? s.liveLoginUrl : null,
      liveRefreshUrl: typeof s.liveRefreshUrl === 'string' ? s.liveRefreshUrl : null,
      loginBody: s.loginBody && typeof s.loginBody === 'object' ? s.loginBody : null,
      // mode fails closed: anything that isn't the exact literal 'AUTO' is PILOT.
      mode: s.mode === 'AUTO' ? 'AUTO' : 'PILOT',
      lastGoodPollAt: typeof s.lastGoodPollAt === 'number' ? s.lastGoodPollAt : null,
      raw: s,
    };
  }
  saveState(patch) {
    const cur = readJson(this._p(STATE)) || {};
    atomicWriteJson(this._p(STATE), { ...cur, ...patch });
  }

  // Single-instance lock: O_EXCL create. Returns a release() or throws if already held by a
  // live process. A stale lock (pid no longer running) is reclaimed.
  acquireLock() {
    const path = this._p(LOCK);
    const tryCreate = () => {
      const fd = openSync(path, 'wx', 0o600); // wx = O_CREAT|O_EXCL
      writeSync(fd, String(process.pid));
      closeSync(fd);
    };
    try { tryCreate(); }
    catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const pid = parseInt(readFileSync(path, 'utf8').trim(), 10);
      if (pid && pidAlive(pid)) {
        const err = new Error(`another matchmaker instance is running (pid ${pid})`);
        err.code = 'ELOCKED';
        throw err;
      }
      // stale lock — reclaim
      try { unlinkSync(path); } catch {}
      tryCreate();
    }
    const release = () => { try { if (existsSync(path)) unlinkSync(path); } catch {} };
    return release;
  }
}

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code === 'EPERM'; } // EPERM = exists but not ours
}
