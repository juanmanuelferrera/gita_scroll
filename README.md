# Scroll Gita

A quiet way to read the *Bhagavad-gītā As It Is*, one verse at a time.

**Live:** <https://vedabase.cc/scrollgita/> · No account, no ads, and the app itself has no analytics.

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

## Tech

- [SvelteKit](https://svelte.dev/docs/kit) (Svelte 5 runes) with `adapter-static`, single-page app (`ssr = false`).
- [Tauri v2](https://v2.tauri.app/) for the desktop and mobile builds (`src-tauri/`, identifier `cc.vedabase.gitascroll`).
- No backend of its own. The web build is plain static files.

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

The output is in `build/`. For vedabase.cc it is copied to `public/scrollgita/` in the `astro_vedabase` repo **without** the big source files (`gita_all_langs.json`, `gita.json`, the three `.svg` placeholders), and deployed with the rest of the site. After building for the web, rebuild without `BASE_PATH` before packaging the Tauri app.

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
src/app.html              page shell (includes noindex)
static/data/              verse data (see above)
test/                     unit tests and the two-device test
scripts/                  data pipeline
src-tauri/                Tauri shell and release workflow (.github/workflows/release.yml, runs on `v*` tags)
```

## Texts and license

The verse texts, translations and purports are those published at [vedabase.cc](https://vedabase.cc) from the works of A. C. Bhaktivedanta Swami Prabhupāda. This repository does not grant any rights over them. No license has been chosen yet for the code, so all rights are reserved until one is added.
