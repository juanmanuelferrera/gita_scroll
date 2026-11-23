// Copia en la nube de Scroll Gita: el MISMO servidor y el mismo código de 8 consonantes que Easy Study (vedabase.cc/api/study).
// El servidor guarda un texto opaco; aquí se decide qué se guarda y cómo se mezclan dos copias. Lógica pura, sin DOM, para poder probarla.
import LZ from 'lz-string';

export const APP = 'scrollgita';
const SKEW = 5 * 60e3;                       // una hora de otro dispositivo puede ir unos minutos por delante
const MAX_IDX = 4000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const CODE_RE = /^(?:[BCDFGHJKLMNPQRSTVWXZ]{6}|[BCDFGHJKLMNPQRSTVWXZ]{8})$/;

/** Acepta minúsculas, espacios y guiones («ktm-rbx…»). Devuelve el código canónico o null. */
export function normalizeCode(raw) {
  const c = String(raw || '').toUpperCase().replace(/[\s\-_.]/g, '');
  return CODE_RE.test(c) ? c : null;
}

const okIdx = (k) => /^\d+$/.test(k) && Number(k) < MAX_IDX;
const okT = (t) => Number.isFinite(t) && t >= 1;

/** Estado vacío / copia de otro dispositivo saneada: lo que viene de fuera no se fía (tiempos futuros, claves raras, tamaños). */
export function clean(x, now = Date.now()) {
  const o = { app: APP, bm: {}, read: {}, ix: [0, 0], streak: { n: 0, last: '' }, resetAt: 0 };
  if (!x || typeof x !== 'object' || x.app !== APP) return o;
  const cap = (t) => Math.min(t, now + SKEW);
  for (const [k, v] of Object.entries(x.bm || {})) if (okIdx(k) && Array.isArray(v) && okT(v[0])) o.bm[k] = [cap(v[0]), v[1] ? 1 : 0];
  for (const [k, t] of Object.entries(x.read || {})) if (okIdx(k) && okT(t)) o.read[k] = cap(t);
  if (Array.isArray(x.ix) && Number.isInteger(x.ix[0]) && x.ix[0] >= 0 && x.ix[0] < MAX_IDX && okT(x.ix[1])) o.ix = [x.ix[0], cap(x.ix[1])];
  const s = x.streak;
  if (s && DAY_RE.test(s.last) && Number.isInteger(s.n) && s.n >= 0 && s.n <= 100000) o.streak = { n: s.n, last: s.last };
  if (okT(x.resetAt)) o.resetAt = Math.min(x.resetAt, now);
  return apply_reset(o);
}

// «Reset data» pone resetAt: lo anterior se descarta en TODOS los dispositivos, no solo en este.
function apply_reset(o) {
  for (const [k, v] of Object.entries(o.bm)) if (v[0] <= o.resetAt) delete o.bm[k];
  for (const [k, t] of Object.entries(o.read)) if (t <= o.resetAt) delete o.read[k];
  if (o.ix[1] <= o.resetAt) o.ix = [0, 0];
  return o;
}

const dayNum = (d) => Date.parse(d + 'T00:00:00Z') / 864e5;
/** Racha: gana la visita más reciente. Si esa visita arrancó una racha de 1 el día siguiente a la otra, es la MISMA racha
 *  (móvil por la mañana, ordenador por la tarde: el segundo dispositivo no sabía nada de ayer) y sigue sumando. */
export function mergeStreak(a, b) {
  const [lo, hi] = a.last <= b.last ? [a, b] : [b, a];
  if (!lo.last) return hi;
  if (lo.last === hi.last) return hi.n >= lo.n ? hi : lo;
  if (hi.n === 1 && dayNum(hi.last) - dayNum(lo.last) === 1) return { n: lo.n + 1, last: hi.last };
  return hi;
}

export function merge(a, b, now = Date.now()) {
  a = clean(a, now); b = clean(b, now);
  const resetAt = Math.max(a.resetAt, b.resetAt);
  const bm = Object.assign({}, a.bm);
  for (const [k, v] of Object.entries(b.bm)) if (!bm[k] || v[0] > bm[k][0] || (v[0] === bm[k][0] && v[1])) bm[k] = v;
  const read = Object.assign({}, a.read);
  for (const [k, t] of Object.entries(b.read)) if (t > (read[k] || 0)) read[k] = t;
  const ix = b.ix[1] > a.ix[1] ? b.ix : a.ix;
  const streak = mergeStreak(a.streak, b.streak);
  return apply_reset({ app: APP, bm, read, ix, streak, resetAt });
}

/** ¿`merged` tiene algo que `state` no tiene? Entonces ese lado hay que ponerlo al día. */
export function behind(state, merged) {
  const s = clean(state);
  return JSON.stringify(sorted(s)) !== JSON.stringify(sorted(merged));
}
const sorted = (o) => ({
  bm: Object.keys(o.bm).sort().map((k) => [k, o.bm[k]]), read: Object.keys(o.read).sort().map((k) => [k, o.read[k]]),
  ix: o.ix, streak: o.streak, resetAt: o.resetAt,
});

/** Lo que se ve al enlazar: «este código tiene N marcadores y M versos leídos». */
export function summary(x) {
  const c = clean(x);
  return { bookmarks: Object.values(c.bm).filter((v) => v[1]).length, read: Object.keys(c.read).length, streak: c.streak.n };
}

export function pack(state) {
  const raw = 'z1:' + LZ.compressToUTF16(JSON.stringify(Object.assign({ v: 1 }, clean(state))));
  if (raw.length > 300000) { const e = new Error('too large'); e.code = 'too_large'; throw e; }
  return raw;
}
export function unpack(txt) {
  const t = String(txt || '');
  const json = t.startsWith('z1:') ? LZ.decompressFromUTF16(t.slice(3)) : t;
  const r = JSON.parse(json || 'null');
  if (!r || r.app !== APP) { const e = new Error('not a Scroll Gita copy'); e.code = 'wrong_app'; throw e; }
  return clean(r);
}

// ---------- cliente del servidor ----------
export function apiBase(hostname) { return (/(^|\.)vedabase\.cc$/.test(hostname) ? '' : 'https://vedabase.cc') + '/api/study'; }
export async function sj(base, path, opts, fetchFn = fetch) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetchFn(base + path, Object.assign({ signal: ctl.signal, headers: { 'Content-Type': 'application/json' } }, opts));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((d.error && d.error.message) || 'HTTP ' + r.status); e.status = r.status; e.code = d.error && d.error.code; throw e; }
    return d;
  } finally { clearTimeout(t); }
}
