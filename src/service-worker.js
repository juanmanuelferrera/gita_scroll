/// <reference lib="webworker" />
// Service worker de Scroll Gita (PWA): la app arranca y se lee sin conexión.
//   · Al instalarse guarda lo imprescindible: la app, los iconos, el índice de versos y el inglés.
//   · Cada idioma se guarda la primera vez que se usa; después se actualiza en segundo plano.
//   · La portada (index.html) va por red primero, para que una versión nueva llegue en cuanto hay conexión.
//   · Solo toca peticiones de su propia ruta: la copia en la nube (/api/study) y el resto de vedabase.cc pasan de largo.
import { base, build, files, version } from '$service-worker';

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));
const APP = `scrollgita-app-${version}`;     // cambia con cada versión: se borra la anterior
const DATA = 'scrollgita-data';              // textos por idioma: sobreviven entre versiones
const DEV = build.length === 0;              // en `npm run dev` no hay ficheros compilados: no se hace nada

const HOME = `${base}/`;
const SHELL = [HOME, ...build, ...files.filter((f) => /\/(icons\/|favicon|manifest)/.test(f))];
const FIRST_DATA = [`${base}/data/core.json`, `${base}/data/en.json`];

if (!DEV) {
  sw.addEventListener('install', (event) => {
    event.waitUntil((async () => {
      await (await caches.open(APP)).addAll(SHELL);
      await (await caches.open(DATA)).addAll(FIRST_DATA);
    })());
  });

  sw.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
      for (const key of await caches.keys()) if (key.startsWith('scrollgita-app-') && key !== APP) await caches.delete(key);
      await sw.clients.claim();
    })());
  });

  sw.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== sw.location.origin || !url.pathname.startsWith(`${base}/`)) return;

    if (request.mode === 'navigate') {                       // la página: red primero, copia si no hay conexión
      event.respondWith((async () => {
        try {
          const res = await fetch(request);
          if (res.ok && url.pathname === HOME) (await caches.open(APP)).put(HOME, res.clone());
          return res;
        } catch {
          return (await caches.match(HOME, { ignoreSearch: true })) || Response.error();
        }
      })());
      return;
    }

    if (url.pathname.startsWith(`${base}/data/`)) {          // textos: de la copia al instante y se refrescan detrás
      event.respondWith((async () => {
        const cache = await caches.open(DATA);
        const hit = await cache.match(request);
        const fresh = fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; });
        if (hit) { event.waitUntil(fresh.catch(() => {})); return hit; }
        return fresh;
      })());
      return;
    }

    event.respondWith((async () => {                         // código, iconos…: con nombre de fichero único, de la copia primero
      const hit = await caches.match(request);
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok) (await caches.open(APP)).put(request, res.clone());
      return res;
    })());
  });
}
