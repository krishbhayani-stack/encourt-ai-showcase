// matchmaker/lib/env.js
// Tiny zero-dependency .env loader (so the daemon needs only node, no npm install).
// Handles KEY=VALUE, # comments on their own line, and surrounding single/double quotes.
import { readFileSync } from 'node:fs';

export function loadEnv(path) {
  let text;
  try { text = readFileSync(path, 'utf8'); }
  catch { return {}; }
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const eq = s.indexOf('=');
    if (eq < 0) continue;
    const key = s.slice(0, eq).trim();
    let val = s.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}
