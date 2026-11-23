# Scroll Gita

A quiet way to read the *Bhagavad-gītā As It Is*, one verse at a time.

**Live:** <https://vedabase.cc/scrollgita/> · No account, no ads, and the app itself has no analytics.

The idea of reading the Gītā as a vertical scroll, one verse at a time, comes from **[One Scroll Gita](https://play.google.com/store/apps/details?id=com.onescrollgita.app)** by Devang Sonawane (Google Play). Scroll Gita is an independent project and shares no code with it.

Open the app and you are on today's verse: Sanskrit, transliteration and translation. Swipe up for another verse. The text is available in 10 languages (English, Español, Português, हिन्दी, বাংলা, 中文, Български, Français, Русский, العربية), with the purports one tap away.

## What it does

- **Home** – a verse of the day, then an endless feed of random verses. It prefers verses you have not read and does not repeat the last 40. Swipe down to go back through the ones you have seen.
- **Gita** – sequential reading, verse by verse and chapter by chapter, with chapter and verse pickers and a progress bar.
- **Profile** – streak, bookmarks (tap to open, ✕ to remove), read count, light/dark theme, and the optional cloud copy.
- **Vertical gestures only.** Swipe up = next, swipe down = previous. On a long verse that scrolls inside, the gesture scrolls the text first and changes verse only once you reach its edge. Mouse wheel and arrow keys work too.
- Language, theme, bookmarks, read verses, streak and reading position are remembered in the browser (`localStorage`). Nothing leaves the device unless you turn on the cloud copy.

### Cloud copy (optional)

Profile → **Save my progress** gives you a short code of 8 consonants (for example `KTMRBXWZ`). Enter it on another phone or computer (**I already have a code**) and your bookmarks, read verses, streak and reading position are merged between them. There is no account and no email.

- It uses the same server and the same kind of code as [Easy Study](https://vedabase.cc/read/) (`/api/study` on vedabase.cc). The server stores an opaque, compressed text; what is stored and how two copies are merged is decided in the client, in [`src/lib/sync.js`](src/lib/sync.js).
- Merge rules: bookmarks – the most recent change per verse wins; read verses – union; reading position – the most recent; streak – the latest visit wins, and a "day 1" on the day after the other device's visit continues the same streak. **Reset data** also resets the other devices.
- Linking asks first with numbers ("this code holds N bookmarks and M verses read"), so a typo cannot mix someone else's progress into yours. A Scroll Gita copy is rejected by Easy Study and the other way round.
- **Anyone who has the code can read the copy.** Keep it private. Copies expire after about 18 months without use.
- The server does not send CORS headers, so the cloud copy only works when the app is served from `vedabase.cc` (it does not work from `localhost` or the desktop build).

## Install it (PWA)

Scroll Gita is a Progressive Web App: you can put it on your home screen, open it full screen like any other app, and read without a connection.

**Install**

- **Android (Chrome):** open <https://vedabase.cc/scrollgita/>, menu ⋮ → **Install app** (or **Add to Home screen**).
- **iPhone / iPad (Safari):** Share → **Add to Home Screen**. (iOS has no install button; this is the only way.)
- **Desktop (Chrome, Edge):** the install icon at the right end of the address bar.

**Offline**

- The app itself, the verse index and **English** are saved the first time you open it, so it starts with no connection.
- Every **other language** is saved the first time you use it, and refreshed quietly in the background afterwards. A language you have never opened needs a connection once; without one, its verses show in English.
- Bookmarks, streak and reading position are stored on the device, so they work offline too. The cloud copy needs a connection and tries again when it returns.
- The page itself is fetched from the network first, so a new version arrives as soon as you are online; the saved copy is only the fallback.

**How it is built**

| Piece | File | What it does |
|---|---|---|
| Manifest | [`static/manifest.webmanifest`](static/manifest.webmanifest) | Name, icons, colours, `standalone` display. Paths are relative, so it works at `/scrollgita/` and at the root. |
| Service worker | [`src/service-worker.js`](src/service-worker.js) | SvelteKit builds and registers it. Precaches the app files and icons plus `data/core.json` and `data/en.json`; language files are cached on first use; navigation is network-first. |
| Page tags | [`src/app.html`](src/app.html) | Manifest link, `apple-touch-icon`, `theme-color`, iOS web-app tags. The theme colour follows the light/dark switch. |
| Icons | `static/icons/`, `static/favicon.png` | 192 and 512 px "any" icons with rounded corners, a full-bleed 512 px "maskable" icon, and a 180 px iOS icon. |

- The worker only handles requests under its own path (`/scrollgita/`). The cloud-copy calls to `/api/study` and the rest of vedabase.cc go straight to the network.
- Each build has a new cache name, and the previous one is deleted when the new worker activates. Language files live in a separate cache that survives updates.
- During `npm run dev` the worker does nothing (there are no compiled files to cache), and the desktop (Tauri) build does not use it.
- Installability was checked with Chrome's own installability report (no errors apart from "incognito", because the test browser was incognito). Offline start was tested by stopping the server. Not tested yet: installing on a physical iPhone and Android phone.

**The icon.** The Sanskrit syllable **गी** (*gī*) in cream on a warm ochre-to-sienna gradient, with two chevrons underneath that echo the swipe-up gesture. The drawing sits inside the central 80 % circle so Android's adaptive masks do not crop it. The source is [`scripts/icon/icon.html`](scripts/icon/icon.html), set in *Tiro Devanagari Sanskrit* (SIL Open Font License). To redraw it:

```bash
# put TiroDevanagariSanskrit-Regular.ttf (Google Fonts) next to icon.html, then:
npm i -D playwright && npx playwright install chromium   # or run with PW_CHANNEL=chrome
node scripts/icon/render.mjs                             # draws the 1024 px PNGs
python3 -I scripts/icon/make_icons.py                    # writes static/icons/* and static/favicon.png
```

`scripts/icon/icon-1024.png` is the master image. It can also feed the desktop and mobile icons: `npx tauri icon scripts/icon/icon-1024.png` (the Tauri icons in `src-tauri/icons/` are still the default ones).

## Tech

- [SvelteKit](https://svelte.dev/docs/kit) (Svelte 5 runes) with `adapter-static`, single-page app (`ssr = false`).
- [Tauri v2](https://v2.tauri.app/) for the desktop and mobile builds (`src-tauri/`, identifier `cc.vedabase.gitascroll`).
- No backend of its own. The web build is plain static files, installable as a PWA (manifest + service worker).

## Run it

```bash
npm install
npm run dev            # http://localhost:1420 (also on your local network)
npm run tauri dev      # desktop window (needs Rust and the Tauri prerequisites)
```

### Test

```bash
node --test test/sync.test.mjs      # merge rules of the cloud copy (8 tests)
node test/e2e-two-devices.mjs       # two simulated devices against the REAL server; creates one small copy there
npm run check                       # svelte-check
```

### Build for the web at `/scrollgita`

The site is served under a sub-path, so the base path is set at build time (the desktop and dev builds use none):

```bash
BASE_PATH=/scrollgita npm run build
```

The output is in `build/`. For vedabase.cc it is copied to `public/scrollgita/` in the `astro_vedabase` repo **without** the big source files (`gita_all_langs.json`, `gita.json`, the three `.svg` placeholders), and deployed with the rest of the site. Copy the rest of `build/` whole: the service worker lists every compiled file and a missing one makes its installation fail. After building for the web, rebuild without `BASE_PATH` before packaging the Tauri app.

## Data

The app does not load one huge file. It loads a small index plus **one file per language**, only when that language is used:

```
static/data/core.json     665 verses: reference, chapter, Sanskrit (≈ 0.2 MB)
static/data/<lang>.json   { "<verse index>": { transliteration, word_for_word, translation, purport } }  (1–3 MB each)
```

They are generated from `static/gita_all_langs.json` (665 verses × 10 languages), which in turn was exported from the vedabase.cc database:

```bash
python3 scripts/export_d1_gita.py   # export from D1 (needs access to that database)
python3 scripts/clean_gita_json.py  # strip markdown artifacts
python3 -I scripts/split_langs.py   # → static/data/core.json and static/data/<lang>.json
```

`scripts/parse_gita.py` is an earlier English-only parser kept for reference.

## Layout

```
src/routes/+page.svelte   the whole app (Home, Gita, Profile)
src/lib/sync.js           cloud copy: merge, pack, server client (pure, no DOM)
src/app.html              page shell (noindex, PWA tags)
src/service-worker.js     offline support (PWA)
static/manifest.webmanifest, static/icons/   PWA manifest and icons
scripts/icon/             source and scripts of the app icon
static/data/              verse data (see above)
test/                     unit tests and the two-device test
scripts/                  data pipeline
src-tauri/                Tauri shell and release workflow (.github/workflows/release.yml, runs on `v*` tags)
```

## Credits

- **Idea:** [One Scroll Gita](https://play.google.com/store/apps/details?id=com.onescrollgita.app) by Devang Sonawane, an Android app for reading the Bhagavad-gītā verse by verse in a vertical scroll. Thank you for the inspiration.
- Cloud copy code format and server: shared with [Easy Study](https://vedabase.cc/read/) on vedabase.cc.

## Texts and license

The verse texts, translations and purports are those published at [vedabase.cc](https://vedabase.cc) from the works of A. C. Bhaktivedanta Swami Prabhupāda. This repository does not grant any rights over them. No license has been chosen yet for the code, so all rights are reserved until one is added.
