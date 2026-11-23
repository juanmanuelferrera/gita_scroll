# Scroll Gita

Estado: app en producción en vedabase.cc/scrollgita (23-nov). Copia en la nube añadida (Profile): mismo servidor y código de 8 consonantes que Easy Study (`/api/study`), lógica en `src/lib/sync.js` (8 tests: `node --test test/sync.test.mjs`; prueba con el servidor real: `node test/e2e-two-devices.mjs`, crea 1 copia).
Siguiente: desplegar la versión con copia en la nube (compilar con `BASE_PATH=/scrollgita npm run build`, copiar a `astro_vedabase/public/scrollgita/` sin los JSON grandes, desplegar con `ship`); Android (`npm run tauri android init`).

## Stack
- Tauri v2 + SvelteKit + Svelte 5 runes
- Datos: `static/gita_all_langs.json` (21 MB, 665 versos × 10 idiomas, exportado de D1 `vedabase-search-db`)
- Identificador: `cc.vedabase.gitascroll`

## Hecho
- Scaffolding Tauri + SvelteKit con `npm run dev` en red (host 0.0.0.0:1420)
- Exportación de todos los idiomas desde D1 (`scripts/export_d1_gita.py`) + limpieza markdown (`scripts/clean_gita_json.py`)
- Tres tabs: Home (verso del día), Gita (lectura secuencial con swipe), Profile (estadísticas + bookmarks)
- Home: devanagari (2 líneas, 1.2rem) + transliteración latina (4 líneas, 1rem, pre-line) + traducción protagonista (1.35rem) + ref badge + barra bookmark/share/Purport
- Picker de idiomas como bottom sheet (10 idiomas, con check en el activo)
- Bookmark por verso (persiste en localStorage)
- Share sheet: imagen canvas 1080×1080 vía `navigator.share({files})` (iOS/Android) o descarga (Windows) + share text + copy + WhatsApp + Telegram
- Streak diario, lectura marcada al pasar verso en Gita
- Dark mode
- `height: 100dvh` para Safari iOS (tab bar siempre visible)
- GitHub Actions `release.yml`: Mac universal dmg, Windows msi/exe, Android APK

## Pendiente
- `git init` y subir a GitHub (necesario para Actions)
- `npm run tauri android init` (ya hay `src-tauri/gen/android` parcial — verificar)
- iOS: requiere Xcode completo (~10 GB) para build nativo
- Probar share image en iPhone real (canvas → `navigator.share`)
- Signing Android (keystore) para Play Store
- iOS signing (certificado Apple) para App Store
- Versos dobles (ej. BG 1.16-18): devanagari muestra 2 líneas, transliteración 4, traducción con scroll si es larga
- Icono de app (src-tauri/icons/)

## Decisiones de diseño
- Home: verso del día = `Math.floor(Date.now()/86400000) % 665` (día del año mod total)
- Read tracking: pasar de verso = marcado como leído (simple)
- Sin "like" — solo bookmark (marcador de lectura) + share
- Traducción a 1.35rem cubre P90 (230 chars) sin scroll en iPhone 12 mini
