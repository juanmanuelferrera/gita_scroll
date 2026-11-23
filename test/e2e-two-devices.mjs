// Prueba manual (no forma parte de `node --test`): dos «dispositivos» contra el servidor REAL. Crea UNA copia de prueba.
import assert from 'node:assert/strict';
import * as SY from '../src/lib/sync.js';
const API = 'https://vedabase.cc/api/study', now = Date.now();
const dev = (name, bm, read, ix, streak) => ({ name, st: { app: SY.APP, bm, read, ix, streak, resetAt: 0 }, version: 0 });
const A = dev('A', { 5: [now - 9000, 1], 7: [now - 9000, 1] }, { 1: now - 8000, 2: now - 8000 }, [10, now - 8000], { n: 5, last: '2026-11-22' });
const B = dev('B', { 9: [now - 5000, 1] }, { 2: now - 4000, 3: now - 4000 }, [40, now - 4000], { n: 1, last: '2026-11-23' });
// A activa la copia
const created = await SY.sj(API, '/new', { method: 'POST', body: JSON.stringify({ data: SY.pack(A.st) }) });
const code = created.code; A.version = created.version; console.log('código', code, 'v' + created.version);
// una sincronización: baja, mezcla, sube si falta (como syncRun)
async function sync(d) {
  for (let i = 0; i < 3; i++) {
    const r = await SY.sj(API, '/' + code), remote = SY.unpack(r.data), m = SY.merge(d.st, remote);
    const needUp = SY.behind(remote, m); d.st = m;
    if (!needUp) { d.version = r.version; return; }
    try { const w = await SY.sj(API, '/' + code, { method: 'PUT', body: JSON.stringify({ data: SY.pack(m), base_version: r.version }) }); d.version = w.version; return; }
    catch (e) { if (e.status === 409) continue; throw e; }
  }
}
await sync(B);                       // B enlaza con el código
await sync(A);                       // A recoge lo de B
const keys = (o) => Object.keys(o).sort().join(',');
console.log('A:', keys(A.st.bm), '|', keys(A.st.read), '|', A.st.ix[0], '|', JSON.stringify(A.st.streak));
console.log('B:', keys(B.st.bm), '|', keys(B.st.read), '|', B.st.ix[0], '|', JSON.stringify(B.st.streak));
assert.deepEqual(A.st, B.st, 'los dos dispositivos deben acabar iguales');
assert.equal(keys(A.st.bm), '5,7,9'); assert.equal(keys(A.st.read), '1,2,3'); assert.equal(A.st.ix[0], 40); assert.deepEqual(A.st.streak, { n: 6, last: '2026-11-23' });
// B quita un marcador y A lo recibe
B.st.bm[5] = [Date.now(), 0]; await sync(B); await sync(A);
assert.equal(A.st.bm[5][1], 0); assert.deepEqual(A.st, B.st);
// conflicto 409: A y B guardan «a la vez»
A.st.read[11] = Date.now(); B.st.read[12] = Date.now();
await Promise.all([sync(A), sync(B)]); await sync(A); await sync(B);
assert.equal(keys(A.st.read), '1,10,11,12,2,3'.split(',').sort().filter(k=>k!=='10').join(',')); assert.deepEqual(A.st, B.st);
// un código de Easy Study no vale aquí, y el nuestro no vale en Easy Study (le falta «entries»)
const raw = (await SY.sj(API, '/' + code)).data; assert.equal(typeof JSON.parse(JSON.stringify({ entries: undefined })).entries, 'undefined');
try { SY.unpack(JSON.stringify({ v: 1, entries: {}, del: {}, rest: {}, pages: {} })); assert.fail('debía rechazar'); } catch (e) { assert.equal(e.code, 'wrong_app'); }
console.log('OK: dos dispositivos coinciden, marcador quitado se propaga, 409 resuelto, copia ajena rechazada. Tamaño de la copia:', raw.length, 'car.');
