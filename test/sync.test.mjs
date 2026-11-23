import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCode, clean, merge, mergeStreak, behind, summary, pack, unpack } from '../src/lib/sync.js';

const NOW = 1_800_000_000_000;
const A = { app: 'scrollgita', bm: { 5: [100, 1], 7: [100, 1] }, read: { 1: 50, 2: 60 }, ix: [10, 200], streak: { n: 3, last: '2026-11-20' }, resetAt: 0 };
const B = { app: 'scrollgita', bm: { 5: [300, 0], 9: [150, 1] }, read: { 2: 90, 3: 95 }, ix: [40, 100], streak: { n: 5, last: '2026-11-22' }, resetAt: 0 };

test('códigos: acepta minúsculas, espacios y guiones; rechaza vocales y longitudes', () => {
  assert.equal(normalizeCode('ktm-rbx wz'), 'KTMRBXWZ');
  assert.equal(normalizeCode('KTMRBX'), 'KTMRBX');
  assert.equal(normalizeCode('KTMRBXA1'), null);
  assert.equal(normalizeCode('KTM'), null);
  assert.equal(normalizeCode(null), null);
});
test('mezcla: gana lo más reciente por verso; leídos = unión; posición = la más nueva; racha = la última', () => {
  const m = merge(A, B, NOW);
  assert.deepEqual(m.bm['5'], [300, 0]);          // quitado más tarde en B
  assert.deepEqual(m.bm['7'], [100, 1]); assert.deepEqual(m.bm['9'], [150, 1]);
  assert.deepEqual(Object.keys(m.read).sort(), ['1', '2', '3']); assert.equal(m.read['2'], 90);
  assert.deepEqual(m.ix, [10, 200]);
  assert.deepEqual(m.streak, { n: 5, last: '2026-11-22' });
});
test('mezcla es conmutativa e idempotente', () => {
  assert.deepEqual(merge(A, B, NOW), merge(B, A, NOW));
  const m = merge(A, B, NOW); assert.deepEqual(merge(m, B, NOW), m); assert.deepEqual(merge(m, m, NOW), m);
});
test('reset en un dispositivo borra lo anterior en el otro; lo nuevo sobrevive', () => {
  const R = { app: 'scrollgita', bm: {}, read: {}, ix: [0, 0], streak: { n: 0, last: '' }, resetAt: 500 };
  const C = { app: 'scrollgita', bm: { 8: [600, 1] }, read: { 4: 700 }, ix: [3, 650], streak: { n: 1, last: '2026-11-23' }, resetAt: 0 };
  const m = merge(merge(A, B, NOW), R, NOW);
  assert.deepEqual(m.bm, {}); assert.deepEqual(m.read, {}); assert.equal(m.resetAt, 500);
  const m2 = merge(m, C, NOW); assert.deepEqual(Object.keys(m2.bm), ['8']); assert.deepEqual(Object.keys(m2.read), ['4']);
});
test('lo que viene de fuera no se fía: futuro, claves raras, otra app', () => {
  const evil = { app: 'scrollgita', bm: { 5: [NOW * 9, 1], x: [1, 1], 99999: [1, 1] }, read: { 1: NOW * 9, '-1': 5 }, ix: [99999, 5], streak: { n: -4, last: 'hoy' }, resetAt: NOW * 9 };
  const c = clean(evil, NOW);
  assert.equal(c.resetAt, NOW);                       // un reset «del futuro» se recorta a ahora
  assert.deepEqual(Object.keys(c.bm), ['5']); assert.equal(c.bm['5'][0], NOW + 5 * 60e3);   // tiempo futuro recortado; claves 'x' y 99999 fuera
  assert.deepEqual(Object.keys(c.read), ['1']); assert.deepEqual(c.ix, [0, 0]); assert.deepEqual(c.streak, { n: 0, last: '' });
  assert.deepEqual(clean({ entries: {}, del: {} }, NOW), clean(null, NOW));   // copia de Easy Study → vacía
  assert.equal(clean({ app: 'scrollgita', bm: { 5: [NOW * 9, 1] }, read: {}, ix: [0, 0], streak: { n: 0, last: '' }, resetAt: 0 }, NOW).bm['5'][0], NOW + 5 * 60e3);
});
test('behind: detecta qué lado debe actualizarse', () => {
  const m = merge(A, B, NOW);
  assert.equal(behind(A, m), true); assert.equal(behind(B, m), true); assert.equal(behind(m, m), false);
});
test('pack/unpack ida y vuelta, y rechaza copias de Easy Study', () => {
  const m = merge(A, B, NOW); assert.deepEqual(unpack(pack(m)), clean(m, Date.now()));
  assert.throws(() => unpack('z1:'), /not a Scroll Gita copy|Unexpected|null/);
  assert.throws(() => unpack(JSON.stringify({ v: 1, entries: {}, del: {}, rest: {}, pages: {} })), (e) => e.code === 'wrong_app');
  assert.deepEqual(summary(m), { bookmarks: 2, read: 3, streak: 5 });
});
test('racha entre dispositivos: el día siguiente sigue la misma racha; un hueco la reinicia', () => {
  assert.deepEqual(mergeStreak({ n: 5, last: '2026-11-22' }, { n: 1, last: '2026-11-23' }), { n: 6, last: '2026-11-23' });
  assert.deepEqual(mergeStreak({ n: 1, last: '2026-11-23' }, { n: 5, last: '2026-11-22' }), { n: 6, last: '2026-11-23' });
  assert.deepEqual(mergeStreak({ n: 5, last: '2026-11-22' }, { n: 1, last: '2026-11-25' }), { n: 1, last: '2026-11-25' });
  assert.deepEqual(mergeStreak({ n: 5, last: '2026-11-23' }, { n: 7, last: '2026-11-23' }), { n: 7, last: '2026-11-23' });
  assert.deepEqual(mergeStreak({ n: 0, last: '' }, { n: 3, last: '2026-11-23' }), { n: 3, last: '2026-11-23' });
  const m = merge({ app: 'scrollgita', streak: { n: 5, last: '2026-11-22' } }, { app: 'scrollgita', streak: { n: 1, last: '2026-11-23' } }, NOW);
  assert.deepEqual(merge(m, m, NOW), m);
});
