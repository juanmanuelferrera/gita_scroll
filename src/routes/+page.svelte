<script>
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import * as SY from '$lib/sync.js';

  // ── Data ─────────────────────────────────────────────────────────────────
  let verses   = $state([]);
  let languages = $state([]);
  let total    = $state(0);
  let packs    = $state({});          // código de idioma → { índice: textos }
  let loadingLang = $state(false);
  let ready    = $state(false);         // true cuando ya se leyeron las preferencias guardadas: hasta entonces los efectos NO deben escribirlas
  let appEl = $state();                 // contenedor raíz (bind:this)

  // ── Copia en la nube (mismo servidor y código que Easy Study) ─────────────
  let bmT = {}, readT = {}, ixT = [0, 0], resetAt = 0;   // marcas de tiempo de cada cambio, para poder mezclar dos dispositivos
  let sync     = $state(null);         // { code, version, at } cuando está activada
  let syncBusy = $state(false);
  let syncErr  = $state('');
  let syncMsg  = $state('');
  let linkOpen = $state(false);
  let linkInput = $state('');
  let linkPreview = $state(null);      // { code, version, remote, n:{bookmarks,read,streak} }
  let nudgeHidden = $state(false);
  let syncOpen = $state(true);         // tarjeta «Your progress is saved»: desplegada o reducida a una línea
  function setSyncOpen(v) { syncOpen = v; save('sg_sync_open', v ? '1' : '0'); }
  let syncTimer = null, applying = false, syncLast = 0, firstSync = true;
  const SYNC_API = typeof location !== 'undefined' ? SY.apiBase(location.hostname) : '/api/study';

  // ── Reader state ──────────────────────────────────────────────────────────
  let currentIndex  = $state(0);
  let currentLang   = $state('en');
  let darkMode      = $state(false);
  let showLangPicker = $state(false);
  let activeTab    = $state('home'); // 'home' | 'gita' | 'profile'
  let bookmarks    = $state(new Set());
  let readVerses   = $state(new Set());
  let streak       = $state(0);
  let showPurport     = $state(false);
  let showHomePurport = $state(false);
  let showShare       = $state(false);
  let confirmReset    = $state(false);
  let animDir      = $state(0);
  let isAnimating  = $state(false);
  let enterDir     = $state(0);       // 1 = el verso nuevo entra desde abajo, -1 = desde arriba
  let hintSeen     = $state(true);    // la pista «desliza hacia arriba» se muestra hasta el primer cambio de verso

  // ── Computed ──────────────────────────────────────────────────────────────
  let verse    = $derived(verses[currentIndex]);
  let langData = $derived(packs[currentLang]?.[currentIndex] || packs.en?.[currentIndex] || {});
  let isBookmarked = $derived(bookmarks.has(currentIndex));
  let progress = $derived(total > 0 ? currentIndex / (total - 1) : 0);

  // Today's verse = first unread verse starting from the day's natural position.
  // The front matter (dedication, preface…: chapter 0) is skipped so the first thing a reader sees is a real verse.
  function pickToday(read) {
    if (!total) return 0;
    const first = Math.max(0, verses.findIndex(v => v.chapter >= 1));
    const n = total - first;
    const base = first + (Math.floor(Date.now() / 86400000) % n);
    if (read.size >= n) return base;
    let idx = base;
    for (let i = 0; i < n; i++) {
      if (!read.has(idx)) return idx;
      idx = idx + 1 >= total ? first : idx + 1;
    }
    return base;
  }
  let todayIndex = $derived(() => pickToday(readVerses));

  // Chapter list
  let chapters = $derived(() => {
    const result = [];
    for (let n = 1; n <= 18; n++) {
      const idx = verses.findIndex(v => v.chapter === n);
      if (idx >= 0) result.push({ number: n, firstIndex: idx, name: CHAPTER_NAMES[n] });
    }
    return result;
  });

  // Verses in current chapter
  let chapterVerses = $derived(() =>
    verses.map((v, i) => ({ ...v, index: i }))
          .filter(v => v.chapter === verse?.chapter)
  );


  // ── Navigation ────────────────────────────────────────────────────────────
  // Home = descubrimiento: hacia arriba sale un verso AL AZAR (prefiere los no leídos y no repite los últimos) y hacia abajo se vuelve atrás
  // por los que ya salieron. La pestaña Gita sigue siendo lectura en orden (verso a verso, capítulo a capítulo).
  let homeHist = [], homePos = -1;
  function pickRandom() {
    const recent = new Set(homeHist.slice(-40));
    const pool = [];
    for (let i = 0; i < total; i++) if (verses[i].chapter >= 1 && !recent.has(i)) pool.push(i);
    const unread = pool.filter((i) => !readVerses.has(i));
    const from = unread.length ? unread : pool;
    return from.length ? from[Math.floor(Math.random() * from.length)] : currentIndex;
  }
  function resetHomeHist(i) { homeHist = [i]; homePos = 0; }

  function navigate(dir) {
    if (isAnimating) return;
    const random = activeTab === 'home';
    let next;
    if (random) {
      if (dir < 0) { if (homePos <= 0) return; next = homeHist[homePos - 1]; }
      else next = homePos < homeHist.length - 1 ? homeHist[homePos + 1] : pickRandom();
    } else {
      next = currentIndex + dir;
      if (next < 0 || next >= total) return;
    }
    // Mark current verse as read
    const s = new Set(readVerses);
    s.add(currentIndex);
    readVerses = s;
    save('sg_read', JSON.stringify([...s]));
    readT[currentIndex] = Date.now(); persistT(); syncSoon(6000);
    animDir = dir;
    isAnimating = true;
    if (!hintSeen) { hintSeen = true; save('sg_hint', '1'); }
    setTimeout(() => {
      currentIndex = next;
      if (random) {
        if (dir < 0) homePos--;
        else { if (homePos === homeHist.length - 1) homeHist = [...homeHist.slice(-199), next]; homePos = homeHist.length - 1; }
      }
      showPurport = false;
      isAnimating = false;
      animDir = 0;
      enterDir = dir; setTimeout(() => { enterDir = 0; }, 280);
      appEl?.querySelectorAll('.home-card, .verse-content').forEach((el) => { el.scrollTop = 0; });
      if (!random) {                                   // la posición de lectura (Gita) no se pisa con el paseo al azar de Home
        save('sg_index', String(currentIndex));
        ixT = [currentIndex, Date.now()]; persistT(); syncSoon(6000);
      }
    }, 200);
  }

  function goToVerse(index) {
    currentIndex = index;
    resetHomeHist(index);
    showPurport = false;
    save('sg_index', String(index));
    ixT = [index, Date.now()]; persistT(); syncSoon(6000);
  }


  // ── Actions ───────────────────────────────────────────────────────────────
  function removeBookmark(idx) {
    const s = new Set(bookmarks); s.delete(idx); bookmarks = s;
    save('sg_bookmarks', JSON.stringify([...s]));
    bmT[idx] = [Date.now(), 0]; persistT(); syncSoon(3000);       // queda constancia del cambio para que se quite también en los otros dispositivos
  }
  function toggleBookmark() {
    const s = new Set(bookmarks);
    if (s.has(currentIndex)) s.delete(currentIndex); else s.add(currentIndex);
    bookmarks = s;
    save('sg_bookmarks', JSON.stringify([...s]));
    bmT[currentIndex] = [Date.now(), s.has(currentIndex) ? 1 : 0]; persistT(); syncSoon(3000);
  }

  // ── Teclado / gestos: el verso cambia en VERTICAL (hacia arriba = siguiente), como en Reels ────────────
  function handleKeydown(e) {
    if (e.key === 'Escape' && linkPreview) { linkPreview = null; return; }
    if (activeTab !== 'gita' && activeTab !== 'home') return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'ArrowRight') navigate(1);
    else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'ArrowLeft') navigate(-1);
    else if (e.key === 'Escape') { showPurport = false; showShare = false; }
  }

  // El texto de un verso largo se desplaza por dentro: solo cambia de verso si ya estás en el borde (arriba o abajo) de ese texto.
  function edges(target, root) {
    const el = target?.closest?.('.home-card, .verse-content') || root?.querySelector?.('.home-card, .verse-content');
    if (!el) return { top: true, bottom: true };
    return { top: el.scrollTop <= 1, bottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 2 };
  }

  function swipeable(node) {
    let startX = 0, startY = 0, ed = { top: true, bottom: true };

    function onStart(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      ed = edges(e.target, node);                 // medido al empezar: si el dedo estaba desplazando el texto, no salta de verso a mitad
    }

    function onEnd(e) {
      const t = e.changedTouches[0];
      const dx = startX - t.clientX;
      const dy = startY - t.clientY;              // dy > 0: el dedo subió
      if (Math.abs(dy) > Math.abs(dx) * 1.2 && Math.abs(dy) > 50) {
        if (dy > 0 && ed.bottom) navigate(1);
        else if (dy < 0 && ed.top) navigate(-1);
      }
    }

    node.addEventListener('touchstart', onStart, { passive: true });
    node.addEventListener('touchend',   onEnd,   { passive: true });
    return {
      destroy() {
        node.removeEventListener('touchstart', onStart);
        node.removeEventListener('touchend',   onEnd);
      }
    };
  }

  let lastWheel = 0;
  function handleWheel(e) {
    if (activeTab !== 'gita' && activeTab !== 'home') return;
    if (Math.abs(e.deltaY) < 30 || Date.now() - lastWheel < 650) return;   // la inercia del trackpad no debe saltar varios versos
    const ed = edges(e.target, appEl);
    if (e.deltaY > 0 && ed.bottom) { lastWheel = Date.now(); navigate(1); }
    else if (e.deltaY < 0 && ed.top) { lastWheel = Date.now(); navigate(-1); }
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  function save(key, val) {
    try { localStorage.setItem(key, val); } catch {}
  }

  function load(key, def = '') {
    try { return localStorage.getItem(key) ?? def; } catch { return def; }
  }

  function updateStreak() {
    const today = new Date().toISOString().slice(0, 10);
    const last  = load('sg_last_visit');
    const n     = parseInt(load('sg_streak', '0'));
    if (!last) streak = 1;
    else if (last === today) streak = n;
    else {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      streak = last === yesterday ? n + 1 : 1;
    }
    save('sg_streak', String(streak));
    save('sg_last_visit', today);
  }


  let loadError = $state('');

  // Descarga el fichero de un idioma (≈1,5 MB) la primera vez que se usa.
  async function ensureLang(code) {
    if (packs[code]) return;
    loadingLang = true;
    try {
      const r = await fetch(`${base}/data/${code}.json`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      packs[code] = await r.json();
    } catch (err) {
      if (code === 'en') throw err;      // sin inglés no hay lectura
    } finally { loadingLang = false; }
  }

  onMount(async () => {
    try {
      const res  = await fetch(`${base}/data/core.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      verses    = data.verses;
      languages = data.languages;
      total     = data.total;
      const saved = load('sg_lang', 'en');
      await ensureLang('en');
      if (saved !== 'en') await ensureLang(saved);
    } catch (err) {
      loadError = 'Could not load the Gita. Please check your connection and reload.';
      return;
    }

    const savedIdx = load('sg_index');           // primera visita: nada guardado → ya se abre el verso de hoy, sin tener que pulsar «Today»
    const idx = savedIdx === '' ? -1 : parseInt(savedIdx);
    currentIndex = idx >= 0 && idx < total ? idx : pickToday(new Set());
    resetHomeHist(currentIndex);
    currentLang  = load('sg_lang', 'en');
    darkMode     = load('sg_dark') === '1';
    ready = true;                                // a partir de aquí los cambios del usuario sí se guardan
    const bm = load('sg_bookmarks');
    if (bm) bookmarks = new Set(JSON.parse(bm));
    const rd = load('sg_read');
    if (rd) readVerses = new Set(JSON.parse(rd));
    updateStreak();
    loadT();
    nudgeHidden = load('sg_nudge') === '1';
    syncOpen = load('sg_sync_open') !== '0';
    hintSeen = load('sg_hint') === '1';
    if (sync) syncRun();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && sync && Date.now() - syncLast > 60000) syncSoon(500);
    });
  });

  // ── Copia en la nube: guardar, mezclar, enlazar ────────────────────────────
  function persistT() {
    save('sg_bm_t', JSON.stringify(bmT)); save('sg_read_t', JSON.stringify(readT));
    save('sg_ix_t', JSON.stringify(ixT)); save('sg_reset_at', String(resetAt));
  }
  function loadT() {
    const j = (k, d) => { try { return JSON.parse(load(k) || 'null') ?? d; } catch { return d; } };
    bmT = j('sg_bm_t', {}); readT = j('sg_read_t', {}); ixT = j('sg_ix_t', [0, 0]); resetAt = parseInt(load('sg_reset_at', '0')) || 0;
    // lo guardado antes de existir la copia en la nube no tiene hora: cuenta como «antiguo» (1)
    for (const i of bookmarks) if (!bmT[i]) bmT[i] = [1, 1];
    for (const i of readVerses) if (!readT[i]) readT[i] = 1;
    if (!ixT[1]) ixT = [currentIndex, 1];
    const sv = j('sg_sync', null); if (sv && SY.normalizeCode(sv.code)) sync = sv;
  }
  const localState = () => ({ app: SY.APP, bm: bmT, read: readT, ix: ixT, resetAt,
    streak: { n: streak, last: load('sg_last_visit') } });
  function applyMerged(m, adoptPlace) {
    applying = true;
    bmT = m.bm; readT = m.read; resetAt = m.resetAt;
    bookmarks  = new Set(Object.entries(m.bm).filter(([, v]) => v[1]).map(([k]) => +k));
    readVerses = new Set(Object.keys(m.read).map(Number));
    save('sg_bookmarks', JSON.stringify([...bookmarks])); save('sg_read', JSON.stringify([...readVerses]));
    if (m.streak.last && m.streak.last >= load('sg_last_visit')) { streak = m.streak.n; save('sg_streak', String(streak)); save('sg_last_visit', m.streak.last); }
    if (adoptPlace && m.ix[1] > ixT[1] && m.ix[0] < total) { currentIndex = m.ix[0]; save('sg_index', String(currentIndex)); }
    if (m.ix[1] > ixT[1]) ixT = m.ix;
    persistT(); applying = false;
  }
  function syncSoon(ms) {
    if (!sync || applying) return;
    clearTimeout(syncTimer); syncTimer = setTimeout(syncRun, ms);
  }
  // Baja la copia, la mezcla con la de este dispositivo y sube lo que falte. Si otro dispositivo guardó entre medias (409), repite.
  async function syncRun() {
    clearTimeout(syncTimer);
    if (!sync || syncBusy) return;
    syncBusy = true; syncErr = '';
    try {
      let pulled = false;
      for (let i = 0; i < 3; i++) {
        const r = await SY.sj(SYNC_API, '/' + sync.code), remote = SY.unpack(r.data), local = localState();
        const m = SY.merge(local, remote);
        if (SY.behind(local, m)) { applyMerged(m, firstSync); pulled = true; }
        if (SY.behind(remote, m)) {
          try {
            const w = await SY.sj(SYNC_API, '/' + sync.code, { method: 'PUT', body: JSON.stringify({ data: SY.pack(localState()), base_version: r.version }) });
            sync = { ...sync, version: w.version }; break;
          } catch (e) { if (e.status === 409 && i < 2) continue; throw e; }
        } else { sync = { ...sync, version: r.version }; break; }
      }
      sync = { ...sync, at: Date.now() }; save('sg_sync', JSON.stringify(sync)); syncLast = Date.now(); firstSync = false;
      if (pulled) syncMsg = 'Updated from your other device.';
    } catch (e) {
      syncErr = e.code === 'too_large' ? 'Your progress is too big for the cloud copy.'
        : e.status === 404 ? 'This code no longer exists.'
        : e.code === 'wrong_app' ? 'This code belongs to another app.'
        : 'Could not save just now. It will try again.';
      if (e.status !== 404 && e.code !== 'too_large' && e.code !== 'wrong_app') syncSoon(120000);
    } finally { syncBusy = false; }
  }
  async function syncEnable() {
    syncErr = ''; syncMsg = ''; syncBusy = true;
    try {
      const r = await SY.sj(SYNC_API, '/new', { method: 'POST', body: JSON.stringify({ data: SY.pack(localState()) }) });
      sync = { code: r.code, version: r.version, at: Date.now() }; save('sg_sync', JSON.stringify(sync)); firstSync = false; setSyncOpen(true);
    } catch (e) { syncErr = e.code === 'too_large' ? 'Your progress is too big for the cloud copy.' : 'Cloud copy is not available right now.'; }
    finally { syncBusy = false; }
  }
  function syncStop() { clearTimeout(syncTimer); sync = null; syncErr = ''; syncMsg = ''; try { localStorage.removeItem('sg_sync'); } catch {} }
  // Enlazar pregunta antes, con números, para que un error al teclear no mezcle el progreso de otra persona con el tuyo.
  async function syncLinkCheck() {
    syncErr = ''; syncMsg = '';
    const code = SY.normalizeCode(linkInput);
    if (!code) { syncErr = 'A code has 8 letters, for example KTMRBXWZ.'; return; }
    syncBusy = true;
    try {
      const r = await SY.sj(SYNC_API, '/' + code); const remote = SY.unpack(r.data);
      linkPreview = { code, version: r.version, n: SY.summary(remote) };
    } catch (e) {
      syncErr = e.status === 404 ? 'No copy with that code.' : e.code === 'wrong_app' ? 'That code belongs to another app, not Scroll Gita.'
        : e.status === 429 ? 'Too many tries. Wait a minute and try again.' : 'Cloud copy is not available right now.';
    } finally { syncBusy = false; }
  }
  async function syncLinkConfirm() {
    const lp = linkPreview; linkPreview = null; linkOpen = false; linkInput = '';
    sync = { code: lp.code, version: lp.version, at: 0 }; save('sg_sync', JSON.stringify(sync)); firstSync = true; setSyncOpen(true);
    await syncRun();
    if (!syncErr) syncMsg = `Linked: ${bookmarks.size} bookmarks, ${readVerses.size} verses read.`;
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(sync.code); syncMsg = 'Code copied.'; } catch { syncMsg = 'Select the code and copy it.'; }
  }
  function syncStatus() {
    if (syncBusy) return 'Saving…';
    if (syncErr) return syncErr;
    if (sync?.at) return 'Saved at ' + new Date(sync.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return '';
  }

  $effect(() => { if (ready && currentLang) { save('sg_lang', currentLang); ensureLang(currentLang); } });
  $effect(() => { if (ready) save('sg_dark', darkMode ? '1' : '0'); });
  $effect(() => { if (activeTab !== 'profile') confirmReset = false; });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function formatRef(ref) {
    return ref ? ref.replace('bg/', '').replace(/\//g, '.') : '';
  }

  function formatDate() {
    return new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  const CHAPTER_NAMES = [
    '', 'Observing the Armies', 'Contents Summarized', 'Karma-yoga',
    'Transcendental Knowledge', 'Action in Kṛṣṇa Consciousness',
    'Dhyāna-yoga', 'Knowledge of the Absolute', 'Attaining the Supreme',
    'The Most Confidential Knowledge', 'The Opulence of the Absolute',
    'The Universal Form', 'Devotional Service', 'Nature and Consciousness',
    'The Three Modes', 'The Yoga of the Supreme Person',
    'Divine and Demoniac Natures', 'The Divisions of Faith',
    'Conclusion – Perfection of Renunciation',
  ];

  const LANG_NAMES = {
    en: 'English', es: 'Español', pt: 'Português', hi: 'हिन्दी',
    bn: 'বাংলা', zh: '中文', bul: 'Български', fr: 'Français',
    ru: 'Русский', ar: 'العربية',
  };

  // Lang display: short label (2–3 chars)
  function langLabel(code) {
    if (code === 'hi') return 'हि';
    if (code === 'bn') return 'বাং';
    if (code === 'zh') return '中';
    if (code === 'bul') return 'БГ';
    if (code === 'ar') return 'ع';
    return code.toUpperCase();
  }

  let bookmarkList = $derived(
    [...bookmarks].map(i => verses[i]).filter(Boolean)
  );

  // ── Share helpers ─────────────────────────────────────────────────────────
  function verseShareText(v, ld) {
    const ref = `Bhagavad-gītā ${formatRef(v.ref)}`;
    const parts = [];
    if (v.devanagari) parts.push(v.devanagari);
    if (ld.transliteration) parts.push(ld.transliteration);
    if (ld.translation) parts.push(ld.translation);
    parts.push(`— ${ref}`);
    parts.push('(Scroll Gita)');
    return parts.join('\n\n');
  }

  function copyVerse(v, ld) {
    navigator.clipboard?.writeText(verseShareText(v, ld));
    showShare = false;
  }

  async function shareText(v, ld) {
    const text = verseShareText(v, ld);
    if (navigator.share) {
      await navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text);
    }
    showShare = false;
  }

  function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let curY = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, curY);
        line = word;
        curY += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, curY);
    return curY + lineH;
  }

  async function buildVerseCanvas(v, ld) {
    const W = 1080, H = 1080, PAD = 80;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#f8f4ee';
    ctx.fillRect(0, 0, W, H);

    // Top accent bar
    ctx.fillStyle = '#b45309';
    ctx.fillRect(PAD, PAD, 100, 5);

    let y = PAD + 50;
    const inner = W - PAD * 2;

    // Devanagari
    if (v.devanagari) {
      ctx.font = '36px serif';
      ctx.fillStyle = '#92400e';
      ctx.textAlign = 'center';
      const devLines = v.devanagari.split('\n');
      for (const line of devLines) {
        ctx.fillText(line.trim(), W / 2, y);
        y += 46;
      }
      y += 10;
    }

    // Transliteration
    if (ld.transliteration) {
      ctx.font = 'italic 28px Georgia, serif';
      ctx.fillStyle = '#78716c';
      ctx.textAlign = 'center';
      const translit = ld.transliteration.replace(/\n/g, ' ').trim();
      y = wrapText(ctx, translit, W / 2, y, inner, 38);
      y += 10;
    }

    // Divider
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(PAD, y, inner, 1);
    y += 30;

    // Translation (main)
    ctx.font = '42px Georgia, serif';
    ctx.fillStyle = '#1a1209';
    ctx.textAlign = 'left';
    const trans = (ld.translation || '').replace(/\n/g, ' ').trim();
    y = wrapText(ctx, trans, PAD, y, inner, 56);
    y += 20;

    // Ref pill
    const ref = `Bhagavad-gītā ${formatRef(v.ref)}`;
    ctx.font = '500 26px system-ui, sans-serif';
    ctx.fillStyle = '#78716c';
    const refW = ctx.measureText(ref).width + 40;
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    const pillH = 44, pillR = 22;
    ctx.beginPath();
    ctx.roundRect(PAD, y, refW, pillH, pillR);
    ctx.fill();
    ctx.fillStyle = '#78716c';
    ctx.font = '500 26px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(ref, PAD + 20, y + 29);
    y += pillH + 20;

    // Footer attribution
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillStyle = '#b45309';
    ctx.textAlign = 'right';
    ctx.fillText('Scroll Gita', W - PAD, H - PAD);

    return canvas;
  }

  async function shareImage(v, ld) {
    const canvas = await buildVerseCanvas(v, ld);
    canvas.toBlob(async (blob) => {
      const file = new File([blob], `BG-${formatRef(v.ref)}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Bhagavad-gītā ${formatRef(v.ref)}` }).catch(() => {});
      } else {
        // Fallback: download the image (Windows / desktop)
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `BG-${formatRef(v.ref)}.png`;
        a.click();
      }
      showShare = false;
    }, 'image/png');
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div
  bind:this={appEl}
  class="app"
  class:dark={darkMode}
  onwheel={handleWheel}
  role="application"
>
  <!-- ══════════════════ HOME TAB ══════════════════ -->
  {#if activeTab === 'home'}
    <div class="screen home-screen" use:swipeable>
      {#if verses.length && verse}
        {@const tl = langData}
        {@const isToday = currentIndex === todayIndex()}

        <!-- Header row: date + streak | lang toggle + theme -->
        <div class="home-header">
          <div>
            <div class="home-date">{formatDate()}</div>
            {#if streak > 1}
              <div class="home-streak">🔥 Day {streak} streak</div>
            {/if}
          </div>
          <div class="home-header-right">
            <button class="lang-pill active" onclick={() => showLangPicker = true} aria-label="Change language">
              {langLabel(currentLang)}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-left:3px;opacity:0.7"><path d="M7 10l5 5 5-5z"/></svg>
            </button>
            <button class="icon-btn" onclick={() => darkMode = !darkMode} aria-label="Toggle theme">
              {#if darkMode}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
              {:else}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              {/if}
            </button>
          </div>
        </div>

        <!-- Aviso de la copia en la nube: fila propia (dentro de la columna de la fecha se partía en 2-3 líneas) -->
        {#if !sync && readVerses.size >= 3 && !nudgeHidden}
          <div class="home-nudge">
            <button class="home-nudge-go" onclick={() => activeTab = 'profile'}>☁ Save your progress in the cloud →</button>
            <button class="home-nudge-x" aria-label="Hide this" onclick={() => { nudgeHidden = true; save('sg_nudge', '1'); }}>×</button>
          </div>
        {/if}

        <!-- Card -->
        <div
          class="home-card"
          class:slide-out-up={isAnimating && animDir === 1}
          class:slide-out-down={isAnimating && animDir === -1}
          class:enter-up={enterDir === 1}
          class:enter-down={enterDir === -1}
        >
          <div class="home-card-header">
            {#if isToday}
              <span class="today-label">TODAY'S VERSE</span>
              <span class="today-label-dot">·</span>
            {/if}
            <span class="home-ref-badge">Bhagavad-gītā {formatRef(verse.ref)}</span>
          </div>
          <div class="home-devanagari">{verse.devanagari.replace(/\s*॥[०-९\d]+॥\s*$/, '').split('\n').slice(0, 2).join('\n')}</div>
          {#if tl.transliteration}
            <div class="home-translit">{tl.transliteration.split('\n').slice(0, 4).join('\n')}</div>
          {/if}
          <div class="translation home-translation">{tl.translation}</div>

        </div>

        <!-- Pista de gesto: asoma la tarjeta siguiente y un chevron que rebota -->
        {#if true}
          <div class="peek" aria-hidden="true"></div>
          <button class="swipe-cue" onclick={() => navigate(1)} aria-label="Next verse">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><polyline points="18 15 12 9 6 15"/></svg>
            {#if !hintSeen}<span>Swipe up for the next verse</span>{/if}
          </button>
        {/if}

        <!-- Actions + meta (single row) -->
        <div class="home-bar">
          <button class="icon-btn" class:bookmarked={isBookmarked} onclick={toggleBookmark} aria-label="Bookmark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button class="icon-btn" onclick={() => showShare = true} aria-label="Share">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          <button class="text-btn home-today-btn" class:active={isToday} onclick={() => goToVerse(todayIndex())} aria-label="Go to today's verse">Today</button>
          {#if tl.purport}
            <button class="text-btn home-purport-btn" onclick={() => showHomePurport = true}>Purport</button>
          {/if}
        </div>
      {:else}
        <div class="loading">{loadError || 'Loading…'}</div>
      {/if}
    </div>
  {/if}

  <!-- ══════════════════ GITA TAB ══════════════════ -->
  {#if activeTab === 'gita'}
    <div class="screen gita-screen" use:swipeable>
      <!-- Top controls -->
      <div class="gita-top">
        <div class="chapter-select-wrap">
          <select
            class="selector"
            value={verse?.chapter}
            onchange={(e) => {
              const ch = chapters().find(c => c.number === parseInt(e.target.value));
              if (ch) goToVerse(ch.firstIndex);
            }}
            aria-label="Select chapter"
          >
            {#each chapters() as ch}
              <option value={ch.number}>Ch {ch.number} · {ch.name}</option>
            {/each}
          </select>
        </div>

        <div class="verse-select-wrap">
          <select
            class="selector verse-selector"
            value={formatRef(verse?.ref)}
            onchange={(e) => {
              const v = chapterVerses().find(v => formatRef(v.ref) === e.target.value);
              if (v) goToVerse(v.index);
            }}
            aria-label="Select verse"
          >
            {#each chapterVerses() as v}
              <option value={formatRef(v.ref)}>{formatRef(v.ref)}</option>
            {/each}
          </select>
        </div>

        <button class="lang-pill active" onclick={() => showLangPicker = true} aria-label="Change language">
          {langLabel(currentLang)}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-left:3px;opacity:0.7"><path d="M7 10l5 5 5-5z"/></svg>
        </button>
      </div>

      <!-- Progress bar -->
      <div class="progress-bar" role="progressbar">
        <div class="progress-fill" style="width:{progress * 100}%"></div>
      </div>

      <!-- Verse content -->
      {#if verse}
        <div
          class="verse-content"
          class:slide-out-up={isAnimating && animDir === 1}
          class:slide-out-down={isAnimating && animDir === -1}
          class:enter-up={enterDir === 1}
          class:enter-down={enterDir === -1}
        >
          <div class="gita-verse-ref">Bhagavad-gītā {formatRef(verse.ref)}</div>
          <div class="devanagari centered">{verse.devanagari.replace(/\s*॥[०-९\d]+॥\s*$/, '')}</div>
          {#if langData.transliteration}
            <div class="transliteration centered">{langData.transliteration}</div>
          {/if}
          <div class="translation gita-translation">{langData.translation}</div>
        </div>
      {:else}
        <div class="loading">{loadError || 'Loading…'}</div>
      {/if}

      {#if verse && currentIndex < total - 1}
        <button class="swipe-cue" onclick={() => navigate(1)} aria-label="Next verse">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><polyline points="18 15 12 9 6 15"/></svg>
          {#if !hintSeen}<span>Swipe up for the next verse</span>{/if}
        </button>
      {/if}

      <!-- Bottom action bar -->
      <div class="gita-bottom">
        <button class="icon-btn" class:bookmarked={isBookmarked} onclick={toggleBookmark} aria-label="Bookmark">
          <svg width="20" height="20" viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
        <button class="icon-btn" onclick={() => showShare = true} aria-label="Share">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
        {#if langData.purport}
          <button class="pill-btn purport-pill" onclick={() => showPurport = true}>Purport</button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- ══════════════════ PROFILE TAB ══════════════════ -->
  {#if activeTab === 'profile'}
    <div class="screen profile-screen">
      <h2 class="profile-title">Profile</h2>

      <div class="stat-row">
        <div class="stat">
          <div class="stat-value">🔥 {streak}</div>
          <div class="stat-label">Day streak</div>
        </div>
        <div class="stat">
          <div class="stat-value">{bookmarks.size}</div>
          <div class="stat-label">Bookmarks</div>
        </div>
        <div class="stat">
          <div class="stat-value">{readVerses.size}</div>
          <div class="stat-label">Read</div>
        </div>
      </div>

      <div class="section-label">Save your progress</div>
      <div class="sync-card">
        {#if !sync}
          <p class="sync-lead">☁ Keep your progress safe</p>
          <p class="sync-text">Save your bookmarks, your streak and where you stopped in the cloud, and continue on any phone or computer. No account, no email: you just get a short code.</p>
          {#if !linkOpen}
            <div class="sync-btns">
              <button class="sync-btn primary" onclick={syncEnable} disabled={syncBusy}>{syncBusy ? 'One moment…' : 'Save my progress'}</button>
              <button class="sync-btn" onclick={() => { linkOpen = true; syncErr = ''; syncMsg = ''; }}>I already have a code</button>
            </div>
          {:else}
            <p class="sync-text">Type the code you got on your other device.</p>
            <input class="sync-input" bind:value={linkInput} placeholder="KTMRBXWZ" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="14"
                   onkeydown={(e) => e.key === 'Enter' && syncLinkCheck()} />
            <div class="sync-btns">
              <button class="sync-btn primary" onclick={syncLinkCheck} disabled={syncBusy}>Continue</button>
              <button class="sync-btn" onclick={() => { linkOpen = false; linkInput = ''; syncErr = ''; }}>Cancel</button>
            </div>
          {/if}
        {:else if !syncOpen}
          <button class="sync-mini" onclick={() => setSyncOpen(true)} aria-expanded="false">
            <span>☁ Progress saved · <b class="sync-mini-code">{sync.code}</b></span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        {:else}
          <button class="sync-close" aria-label="Close" onclick={() => setSyncOpen(false)}>×</button>
          <p class="sync-lead">☁ Your progress is saved</p>
          <div class="sync-code" aria-label="Your code">{sync.code}</div>
          <p class="sync-text">Write this code down. To continue on another device, open Scroll Gita there, go to Profile and choose <b>I already have a code</b>. Anyone with the code can see your bookmarks, so keep it private.</p>
          <div class="sync-btns">
            <button class="sync-btn" onclick={copyCode}>Copy code</button>
            <button class="sync-btn" onclick={syncRun} disabled={syncBusy}>Save now</button>
            <button class="sync-btn quiet" onclick={syncStop}>Stop saving</button>
          </div>
        {/if}
        {#if (syncStatus() || syncMsg) && (syncOpen || !sync || syncErr)}
          <p class="sync-status" class:bad={!!syncErr && !syncBusy} aria-live="polite">{syncMsg && !syncErr ? syncMsg : syncStatus()}</p>
        {/if}
      </div>

      <div class="section-label">Appearance</div>
      <div class="appearance-row">
        <button class="appear-btn" class:selected={!darkMode} onclick={() => darkMode = false}>Light</button>
        <button class="appear-btn" class:selected={darkMode} onclick={() => darkMode = true}>Dark</button>
      </div>

      {#if bookmarkList.length}
        <div class="section-label">Bookmarks</div>
        <div class="bookmark-list">
          {#each bookmarkList as v, i}
            {@const ld = packs[currentLang]?.[v.index] || packs.en?.[v.index] || {}}
            <div class="bookmark-row">
              <button
                class="bookmark-item"
                onclick={() => { goToVerse(v.index); activeTab = 'home'; }}
              >
                <span class="bm-ref">BG {formatRef(v.ref)}</span>
                <span class="bm-preview">{ld.translation?.slice(0, 60)}…</span>
              </button>
              <button class="bm-remove" aria-label="Remove BG {formatRef(v.ref)} from bookmarks" onclick={() => removeBookmark(v.index)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}

      <!-- spacer so last bookmark isn't hidden behind floating button -->
            <!-- Reset: al final del contenido, no flotando encima (en pantallas pequeñas tapaba los botones) -->
    {#if !confirmReset && !linkPreview}
      <button class="reset-fab" onclick={() => confirmReset = true}>Reset data</button>
    {:else}
      <div class="reset-confirm">
        <p>This will delete your streak, bookmarks and read history{#if sync}, and also from your cloud copy and your other devices{/if}. Continue?</p>
        <div class="reset-confirm-btns">
          <button class="reset-cancel" onclick={() => confirmReset = false}>Cancel</button>
          <button class="reset-ok" onclick={() => {
            bookmarks = new Set();
            readVerses = new Set();
            streak = 0;
            confirmReset = false;
            ['sg_bookmarks','sg_read','sg_streak','sg_last_visit'].forEach(k => localStorage.removeItem(k));
            bmT = {}; readT = {}; ixT = [0, 0]; resetAt = Date.now(); persistT(); syncSoon(500);
          }}>Delete all</button>
        </div>
      </div>
    {/if}
      <div style="height:1.5rem"></div>
    </div>

  {/if}

  {#if linkPreview}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="sync-modal" role="dialog" aria-modal="true" aria-label="Link to this code?" onclick={(e) => { if (e.target === e.currentTarget) linkPreview = null; }}>
      <div class="sync-modal-box">
        <button class="sync-modal-x" aria-label="Close" onclick={() => { linkPreview = null; }}>×</button>
        <p class="sync-lead">Link to code {linkPreview.code}?</p>
        <p class="sync-text">This code holds <b>{linkPreview.n.bookmarks}</b> bookmarks and <b>{linkPreview.n.read}</b> verses read. This device has <b>{bookmarks.size}</b> bookmarks and <b>{readVerses.size}</b> read. Linking combines both: nothing is deleted. Is this your code?</p>
        <div class="sync-btns">
          <button class="sync-btn primary" onclick={syncLinkConfirm}>Yes, link</button>
          <button class="sync-btn" onclick={() => { linkPreview = null; }}>Cancel</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- ══════════════════ TAB BAR ══════════════════ -->
  <nav class="tab-bar">
    <button class="tab" class:active={activeTab === 'home'} onclick={() => activeTab = 'home'}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
      <span>Home</span>
    </button>
    <button class="tab" class:active={activeTab === 'gita'} onclick={() => activeTab = 'gita'}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
      <span>Gita</span>
    </button>
    <button class="tab" class:active={activeTab === 'profile'} onclick={() => activeTab = 'profile'}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <span>Profile</span>
    </button>
  </nav>

  <!-- ══════════════════ LANG PICKER SHEET ══════════════════ -->
  {#if showLangPicker}
    <div class="overlay" onclick={() => showLangPicker = false} role="presentation">
      <div class="bottom-sheet lang-picker-sheet"
        onclick={(e) => e.stopPropagation()}
        ontouchstart={(e) => e.stopPropagation()}
        ontouchend={(e) => e.stopPropagation()}
        ontouchmove={(e) => e.stopPropagation()}
        role="dialog" aria-label="Select language">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <span class="sheet-title">Language</span>
          <button class="icon-btn" onclick={() => showLangPicker = false} aria-label="Close">×</button>
        </div>
        <div class="lang-picker-list">
          {#each languages as lang}
            <button
              class="lang-option"
              class:selected={currentLang === lang.code}
              onclick={() => { currentLang = lang.code; showLangPicker = false; }}
            >
              <span class="lang-native">{lang.name}</span>
              <span class="lang-code">{langLabel(lang.code)}</span>
              {#if currentLang === lang.code}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- ══════════════════ HOME PURPORT SHEET ══════════════════ -->
  {#if showHomePurport && verse}
    <div class="overlay" onclick={() => showHomePurport = false} role="presentation">
      <div class="bottom-sheet"
        onclick={(e) => e.stopPropagation()}
        ontouchstart={(e) => e.stopPropagation()}
        ontouchend={(e) => e.stopPropagation()}
        ontouchmove={(e) => e.stopPropagation()}
        role="dialog" aria-label="Purport">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <span class="sheet-title">Purport · BG {formatRef(verse.ref)}</span>
          <button class="icon-btn" onclick={() => showHomePurport = false} aria-label="Close">×</button>
        </div>
        <div class="sheet-body">
          <p class="purport-text">{langData.purport}</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- ══════════════════ PURPORT SHEET ══════════════════ -->
  {#if showPurport}
    <div class="overlay" onclick={() => showPurport = false} role="presentation">
      <div class="bottom-sheet"
        onclick={(e) => e.stopPropagation()}
        ontouchstart={(e) => e.stopPropagation()}
        ontouchend={(e) => e.stopPropagation()}
        ontouchmove={(e) => e.stopPropagation()}
        role="dialog" aria-label="Purport">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <span class="sheet-title">Purport · BG {formatRef(verse?.ref)}</span>
          <button class="icon-btn" onclick={() => showPurport = false} aria-label="Close">×</button>
        </div>
        <div class="sheet-body">
          <p class="purport-text">{langData.purport}</p>
        </div>
      </div>
    </div>
  {/if}

  <!-- ══════════════════ SHARE SHEET ══════════════════ -->
  {#if showShare && verse}
    <div class="overlay" onclick={() => showShare = false} role="presentation">
      <div class="bottom-sheet share-sheet"
        onclick={(e) => e.stopPropagation()}
        ontouchstart={(e) => e.stopPropagation()}
        ontouchend={(e) => e.stopPropagation()}
        ontouchmove={(e) => e.stopPropagation()}
        role="dialog" aria-label="Share verse">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <span class="sheet-title">Share · BG {formatRef(verse.ref)}</span>
          <button class="icon-btn" onclick={() => showShare = false} aria-label="Close">×</button>
        </div>
        <div class="sheet-body share-body">
          <!-- Card preview -->
          <div class="share-card">
            <div class="share-devanagari">{verse.devanagari}</div>
            {#if langData.transliteration}
              <div class="share-translit">{langData.transliteration}</div>
            {/if}
            <div class="share-translation">{langData.translation}</div>
            <div class="share-footer">
              <div class="share-ref">Bhagavad-gītā {formatRef(verse.ref)}</div>
              <div class="share-attr">Scroll Gita</div>
            </div>
          </div>

          <!-- Share actions grid -->
          <div class="share-actions">
            <button class="share-action-btn" onclick={() => shareImage(verse, langData)}>
              <span class="share-action-icon">🖼️</span>
              <span>Share image</span>
            </button>
            <button class="share-action-btn" onclick={() => shareText(verse, langData)}>
              <span class="share-action-icon">📤</span>
              <span>Share text</span>
            </button>
            <button class="share-action-btn" onclick={() => copyVerse(verse, langData)}>
              <span class="share-action-icon">📋</span>
              <span>Copy</span>
            </button>
            <a class="share-action-btn" href="https://wa.me/?text={encodeURIComponent(verseShareText(verse, langData))}" target="_blank" rel="noopener">
              <span class="share-action-icon">🟢</span>
              <span>WhatsApp</span>
            </a>
            <a class="share-action-btn" href="https://t.me/share/url?url=&text={encodeURIComponent(verseShareText(verse, langData))}" target="_blank" rel="noopener">
              <span class="share-action-icon">✈️</span>
              <span>Telegram</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(*) { box-sizing: border-box; margin: 0; padding: 0; }
  :global(html, body) { height: 100%; overflow: hidden; }

  /* ── Root ── */
  .app {
    height: 100vh;
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: #f8f4ee;
    color: #1a1209;
    font-family: Georgia, 'Times New Roman', serif;
    transition: background 0.25s, color 0.25s;
    overflow: hidden;
    --muted: #6b655d;
  }
  .app.dark { background: #111009; color: #e8dfc8; --muted: #a8a190; }

  .screen {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.4;
    font-family: system-ui, sans-serif;
  }

  /* ── HOME ── */
  .home-screen { padding: 0.75rem 1.1rem 0.3rem; gap: 0.55rem; position: relative; }

  .home-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .home-header-right {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
    flex-wrap: nowrap;
  }


  .home-date {
    font-family: system-ui, sans-serif;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--muted);
  }

  .home-streak {
    font-family: system-ui, sans-serif;
    font-size: 0.75rem;
    opacity: 0.65;
    margin-top: 0.1rem;
  }

  .home-card-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding-bottom: 0.1rem;
  }

  .today-label {
    font-family: system-ui, sans-serif;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #b45309;
    text-transform: uppercase;
  }
  .app.dark .today-label { color: #d97706; }

  .today-label-dot {
    font-family: system-ui, sans-serif;
    font-size: 0.82rem;
    color: #b45309;
    opacity: 0.4;
  }
  .app.dark .today-label-dot { color: #d97706; }

  .home-card {
    background: white;
    border-radius: 16px;
    padding: 1.1rem 1.1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    box-shadow: 0 1px 8px rgba(0,0,0,0.07);
    flex: 1;
    overflow-y: auto;
  }
  .app.dark .home-card { background: #1e1b14; box-shadow: 0 1px 8px rgba(0,0,0,0.3); }

  .home-devanagari {
    font-size: 1.2rem;
    line-height: 1.75;
    color: #92400e;
    white-space: pre-line;
    text-align: center;
  }
  .app.dark .home-devanagari { color: #d97706; }

  .home-translit {
    font-size: 1.15rem;
    font-style: italic;
    color: var(--muted);
    text-align: center;
    line-height: 1.65;
    white-space: pre-line;
  }
  .app.dark .home-translit { color: #a8a29e; }

  .home-translation { font-size: 1.2rem; line-height: 1.85; }

  .home-ref-badge {
    font-family: system-ui, sans-serif;
    font-size: 0.82rem;
    font-weight: 600;
    color: #78716c;
  }
  .app.dark .home-ref-badge { background: rgba(255,255,255,0.08); color: #a8a29e; }

  .home-bar {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    padding-bottom: 0.2rem;
  }

  .home-purport-btn { margin-left: auto; }

  /* ── GITA ── */
  .gita-screen { padding: 0; }

  .gita-top {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.8rem;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .app.dark .gita-top { border-color: rgba(255,255,255,0.06); }

  .chapter-select-wrap { flex: 1; min-width: 0; }
  .verse-select-wrap { flex-shrink: 0; }

  .selector {
    appearance: none;
    background: rgba(0,0,0,0.04);
    border: 1px solid rgba(0,0,0,0.1);
    border-radius: 20px;
    padding: 0.3rem 1.6rem 0.3rem 0.7rem;
    font-size: 0.78rem;
    font-family: system-ui, sans-serif;
    font-weight: 500;
    color: inherit;
    cursor: pointer;
    width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%23888'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.4rem center;
    min-height: 44px;
  }
  .app.dark .selector {
    background-color: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.1);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%23aaa'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
  }

  .verse-selector { width: auto; min-width: 60px; }


  .lang-pill {
    background: rgba(0,0,0,0.05);
    border: none;
    border-radius: 20px;
    padding: 0.25rem 0.6rem;
    font-size: 0.72rem;
    font-weight: 600;
    font-family: system-ui, sans-serif;
    cursor: pointer;
    color: inherit;
    opacity: 0.6;
    transition: background 0.15s, opacity 0.15s;
    position: relative;
  }
  .lang-pill::after { content: ''; position: absolute; inset: -12px -6px; }   /* zona de toque de 44 px sin agrandar la píldora */
  .lang-pill.active {
    background: #b45309;
    color: white;
    opacity: 1;
  }
  .app.dark .lang-pill { background: rgba(255,255,255,0.08); }
  .app.dark .lang-pill.active { background: #b45309; }

  /* Progress bar */
  .progress-bar { height: 2px; background: rgba(0,0,0,0.05); flex-shrink: 0; }
  .app.dark .progress-bar { background: rgba(255,255,255,0.05); }
  .progress-fill { height: 100%; background: #b45309; transition: width 0.3s ease; }
  .app.dark .progress-fill { background: #d97706; }

  .gita-verse-ref {
    font-size: 0.82rem;
    font-weight: 600;
    color: #b45309;
    letter-spacing: 0.03em;
    text-align: center;
    padding-bottom: 0.2rem;
  }
  .app.dark .gita-verse-ref { color: #d97706; }

  /* Verse content */
  .verse-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.2rem 1.4rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 640px;
    width: 100%;
    margin: 0 auto;
    transition: transform 0.2s ease, opacity 0.2s ease;
    position: relative;
  }
  .slide-out-up   { transform: translateY(-20px); opacity: 0; }
  .slide-out-down { transform: translateY(20px);  opacity: 0; }

  /* Entrada del verso nuevo: desde abajo al avanzar, desde arriba al volver */
  .enter-up   { animation: enter-up 0.24s ease; }
  .enter-down { animation: enter-down 0.24s ease; }
  @keyframes enter-up   { from { transform: translateY(36px);  opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes enter-down { from { transform: translateY(-36px); opacity: 0; } to { transform: none; opacity: 1; } }

  /* Pista de gesto: chevron que rebota (con texto hasta el primer cambio de verso) y, en Home, el borde de la tarjeta siguiente */
  .swipe-cue {
    display: flex; align-items: center; justify-content: center; gap: 0.35rem; align-self: center; flex-shrink: 0;
    background: none; border: none; color: #b45309; cursor: pointer; min-height: 44px; padding: 0 0.8rem;
    font-family: system-ui, sans-serif; font-size: 0.78rem; font-weight: 600; animation: cue-bob 1.7s ease-in-out infinite;
  }
  .app.dark .swipe-cue { color: #f0b45a; }
  .swipe-cue:active { opacity: 0.6; }
  @keyframes cue-bob { 0%, 100% { transform: translateY(2px); opacity: 0.55; } 50% { transform: translateY(-4px); opacity: 1; } }
  .peek { flex-shrink: 0; height: 12px; margin: -0.55rem 1.1rem 0; border-radius: 0 0 14px 14px; background: white; opacity: 0.7; box-shadow: 0 2px 6px rgba(0,0,0,0.07); }
  .app.dark .peek { background: #1e1b14; opacity: 0.8; }
  @media (prefers-reduced-motion: reduce) { .swipe-cue { animation: none; } }

  .gita-translation { font-size: 1.2rem; line-height: 1.85; }

  /* Gita bottom bar */
  .gita-bottom {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1rem;
    border-top: 1px solid rgba(0,0,0,0.07);
    flex-shrink: 0;
  }
  .app.dark .gita-bottom { border-color: rgba(255,255,255,0.07); }
  .gita-bottom .purport-pill { margin-left: auto; }

  /* ── PROFILE ── */
  .profile-screen { padding: 1.2rem 1.2rem 0.5rem; gap: 1rem; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }

  .profile-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: #b45309;
  }
  .app.dark .profile-title { color: #d97706; }

  /* ── Copia en la nube ───────────────────────────────────────────────── */
  .sync-card { position: relative; background: white; border-radius: 12px; padding: 0.9rem 1rem; font-family: system-ui, sans-serif; }
  .sync-close { position: absolute; top: 0.35rem; right: 0.4rem; width: 2.4rem; height: 2.4rem; background: none; border: none; font-size: 1.7rem; line-height: 1; color: inherit; opacity: 0.5; cursor: pointer; }
  .sync-mini { display: flex; align-items: center; justify-content: space-between; width: 100%; background: none; border: none; color: inherit; font: inherit; font-size: 0.92rem; padding: 0.2rem 0; cursor: pointer; text-align: left; }
  .sync-mini-code { font-family: ui-monospace, Menlo, monospace; letter-spacing: 0.12em; }
  .app.dark .sync-card { background: #1e1b14; }
  .sync-lead { font-weight: 700; font-size: 1rem; margin: 0 0 0.35rem; }
  .sync-text { font-size: 0.86rem; line-height: 1.45; opacity: 0.75; margin: 0 0 0.7rem; }
  .sync-code { font-family: ui-monospace, Menlo, monospace; font-size: 1.7rem; font-weight: 700; letter-spacing: 0.18em; text-align: center; padding: 0.55rem 0; margin: 0.2rem 0 0.7rem; background: rgba(180, 83, 9, 0.08); border-radius: 10px; user-select: all; }
  .sync-input { width: 100%; box-sizing: border-box; font-family: ui-monospace, Menlo, monospace; font-size: 1.3rem; letter-spacing: 0.16em; text-transform: uppercase; text-align: center; padding: 0.55rem; border: 1px solid rgba(0,0,0,0.2); border-radius: 10px; background: transparent; color: inherit; margin-bottom: 0.7rem; }
  .app.dark .sync-input { border-color: rgba(255,255,255,0.25); }
  .sync-btns { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .sync-btn { background: transparent; border: 1px solid rgba(0,0,0,0.25); border-radius: 8px; padding: 0.5rem 0.9rem; font-size: 0.88rem; font-weight: 600; cursor: pointer; color: inherit; min-height: 44px; }
  .app.dark .sync-btn { border-color: rgba(255,255,255,0.3); }
  .sync-btn.primary { background: #b45309; border-color: #b45309; color: #fff; }
  .sync-btn.quiet { border-color: transparent; color: var(--muted); }
  .sync-btn:disabled { opacity: 0.5; cursor: default; }
  .sync-status { font-size: 0.78rem; opacity: 0.6; margin: 0.7rem 0 0; }
  .sync-status.bad { color: #b91c1c; opacity: 1; }
  .sync-modal { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 1.2rem; z-index: 1000; }
  .sync-modal-x { position: absolute; top: 0.3rem; right: 0.4rem; width: 2.4rem; height: 2.4rem; background: none; border: none; font-size: 1.7rem; line-height: 1; color: inherit; opacity: 0.55; cursor: pointer; }
  .sync-modal-box { position: relative; background: #fffdf8; color: #2a2418; border-radius: 14px; padding: 1.1rem; max-width: 22rem; width: 100%; font-family: system-ui, sans-serif; }
  .app.dark .sync-modal-box { background: #1e1b14; color: #eee6d4; }
  .home-nudge { display: flex; align-items: center; gap: 0.3rem; margin-top: 0.35rem; flex-shrink: 0; }
  .home-nudge-go { background: rgba(180, 83, 9, 0.1); border: none; border-radius: 999px; padding: 0.3rem 0.7rem; font-family: system-ui, sans-serif; font-size: 0.76rem; font-weight: 600; color: #92400e; cursor: pointer; min-height: 44px; white-space: nowrap; }
  .app.dark .home-nudge-go { color: #f0b45a; background: rgba(240, 180, 90, 0.12); }
  .home-nudge-x { background: transparent; border: none; font-size: 1.1rem; opacity: 0.6; cursor: pointer; color: inherit; padding: 0; min-width: 44px; min-height: 44px; margin-left: -0.5rem; }
  .stat-row { display: flex; gap: 1rem; }

  .stat {
    flex: 1;
    background: white;
    border-radius: 12px;
    padding: 0.8rem;
    text-align: center;
  }
  .app.dark .stat { background: #1e1b14; }

  .stat-value { font-size: 1.3rem; font-weight: 700; }
  .stat-label { font-size: 0.72rem; font-family: system-ui, sans-serif; color: var(--muted); margin-top: 0.1rem; }

  .section-label {
    font-family: system-ui, sans-serif;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    margin-top: 0.3rem;
  }


  .lang-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    width: 100%; min-height: 48px; padding: 0.7rem 0.3rem;
    border-bottom: 1px solid rgba(0,0,0,0.05);
    font-family: inherit;
    text-align: left;
  }
  .lang-option:hover { background: rgba(0,0,0,0.02); }
  .lang-option.selected { color: #b45309; }
  .app.dark .lang-option.selected { color: #d97706; }
  .app.dark .lang-option { border-color: rgba(255,255,255,0.05); }

  .lang-native { flex: 1; font-size: 0.95rem; }
  .lang-code { font-family: system-ui, sans-serif; font-size: 0.7rem; color: var(--muted); text-transform: uppercase; }

  .appearance-row { display: flex; gap: 0.5rem; }

  .appear-btn {
    flex: 1;
    padding: 0.6rem;
    border: 1px solid rgba(0,0,0,0.12);
    border-radius: 10px;
    background: none;
    cursor: pointer;
    color: inherit;
    font-family: system-ui, sans-serif;
    font-size: 0.85rem;
    font-weight: 500;
    transition: background 0.15s, border-color 0.15s;
    min-height: 44px;
  }
  .appear-btn.selected {
    background: #b45309;
    color: white;
    border-color: transparent;
  }
  .app.dark .appear-btn { border-color: rgba(255,255,255,0.12); }
  .app.dark .appear-btn.selected { background: #b45309; }

  .bookmark-list { display: flex; flex-direction: column; gap: 0; }
  .bookmark-row { display: flex; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.05); }
  .bookmark-row .bookmark-item { flex: 1; min-width: 0; border-bottom: none; }
  .bm-remove { flex-shrink: 0; width: 2.75rem; height: 2.75rem; display: flex; align-items: center; justify-content: center; background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; border-radius: 8px; }
  .bm-remove:active { opacity: 0.9; background: rgba(180, 83, 9, 0.1); }
  .app.dark .bookmark-row { border-bottom-color: rgba(255,255,255,0.07); }

  .bookmark-item {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    padding: 0.75rem 0.3rem;
    border-bottom: 1px solid rgba(0,0,0,0.05);
    font-family: inherit;
  }
  .bm-ref { font-size: 0.72rem; font-weight: 700; color: #b45309; font-family: system-ui, sans-serif; }
  .app.dark .bm-ref { color: #d97706; }
  .bm-preview { font-size: 0.85rem; color: var(--muted); }

  /* ── TAB BAR ── */
  .tab-bar {
    display: flex;
    border-top: 1px solid rgba(0,0,0,0.08);
    flex-shrink: 0;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .app.dark .tab-bar { border-color: rgba(255,255,255,0.08); }

  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.6rem 0.5rem;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    color: var(--muted);
    font-family: system-ui, sans-serif;
    font-size: 0.72rem;
    font-weight: 500;
    transition: opacity 0.15s;
  }
  .tab.active {
    color: #b45309;
  }
  .app.dark .tab.active { color: #d97706; }

  /* ── Shared typography ── */
  .devanagari {
    font-size: 1.2rem;
    line-height: 1.75;
    color: #92400e;
    white-space: pre-line;
  }
  .app.dark .devanagari { color: #d97706; }

  .devanagari.centered { text-align: center; }

  .transliteration {
    font-size: 1.15rem;
    font-style: italic;
    color: var(--muted);
    white-space: pre-line;
    line-height: 1.65;
  }
  .transliteration.centered { text-align: center; }
  .app.dark .transliteration { color: #a8a29e; }

  .translation { white-space: pre-line; }

  /* ── Buttons ── */
  .icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    padding: 0.4rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    opacity: 0.55;
    transition: opacity 0.15s;
    min-width: 44px; min-height: 44px; justify-content: center;
  }
  .icon-btn:hover { opacity: 0.9; }
  .icon-btn.bookmarked { opacity: 1; color: #b45309; }
  .app.dark .icon-btn.bookmarked { color: #d97706; }

  .pill-btn {
    border: none;
    border-radius: 24px;
    padding: 0.5rem 1.2rem;
    font-size: 0.85rem;
    font-weight: 600;
    font-family: system-ui, sans-serif;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    min-height: 44px;
  }


  .purport-pill {
    background: #f0cba0;
    color: #7c2d12;
  }
  .app.dark .purport-pill { background: #92400e; color: #fff7ed; }

  .text-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: #92400e;
    font-size: 0.9rem;
    font-weight: 600;
    font-family: system-ui, sans-serif;
    padding: 0 0.5rem; min-height: 44px;
    
  }
  .text-btn:hover { text-decoration: underline; }
  .app.dark .text-btn { color: #d97706; }

  .home-today-btn { font-size: 0.82rem;  }
  .home-today-btn.active { color: var(--muted); font-weight: 500; cursor: default; text-decoration: none; }

  .reset-fab {
    position: static;
    width: 100%;
    margin-top: 0.8rem;
    background: rgba(255,255,255,0.95);
    border: 1px solid rgba(180,83,9,0.3);
    border-radius: 12px;
    color: #b45309;
    font-size: 0.95rem;
    font-weight: 600;
    padding: 1rem 1rem;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  }
  .app.dark .reset-fab { background: rgba(30,27,20,0.95); color: #d97706; border-color: rgba(217,119,6,0.3); }

  .reset-confirm {
    position: static;
    margin-top: 0.8rem;
    background: #fff;
    border: 1px solid rgba(180,83,9,0.2);
    border-radius: 14px;
    padding: 1rem 1.1rem 0.9rem;
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    z-index: 10;
  }
  .app.dark .reset-confirm { background: #1e1b14; border-color: rgba(217,119,6,0.2); }
  .reset-confirm p { font-size: 0.9rem; margin: 0 0 0.75rem; line-height: 1.5; color: #57534e; }
  .app.dark .reset-confirm p { color: #a8a29e; }
  .reset-confirm-btns { display: flex; gap: 0.6rem; justify-content: flex-end; }
  .reset-cancel {
    background: none; border: 1px solid rgba(0,0,0,0.12); border-radius: 8px;
    padding: 0.45rem 1rem; font-size: 0.88rem; cursor: pointer; color: #78716c;
  }
  .reset-ok {
    background: #b45309; border: none; border-radius: 8px;
    padding: 0.45rem 1rem; font-size: 0.88rem; font-weight: 600; cursor: pointer; color: #fff;
  }
  .app.dark .reset-cancel { border-color: rgba(255,255,255,0.15); color: #a8a29e; }
  .app.dark .reset-ok { background: #d97706; }

  /* ── Overlay & bottom sheets ── */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 200;
    display: flex;
    align-items: flex-end;
    animation: fade-in 0.18s ease;
  }

  @keyframes fade-in { from { opacity: 0; } }

  .bottom-sheet {
    background: #f8f4ee;
    width: 100%;
    max-height: 80vh;
    border-radius: 20px 20px 0 0;
    display: flex;
    flex-direction: column;
    animation: slide-up 0.22s ease;
  }
  .app.dark .bottom-sheet { background: #1a1710; }

  @keyframes slide-up {
    from { transform: translateY(40px); opacity: 0; }
  }

  .sheet-handle {
    width: 36px; height: 4px;
    background: rgba(0,0,0,0.12);
    border-radius: 2px;
    margin: 0.6rem auto 0;
    flex-shrink: 0;
  }
  .app.dark .sheet-handle { background: rgba(255,255,255,0.15); }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.7rem 1.1rem 0.4rem;
    flex-shrink: 0;
  }

  .sheet-title {
    font-size: 0.82rem;
    font-weight: 700;
    font-family: system-ui, sans-serif;
    letter-spacing: 0.03em;
    color: #b45309;
  }
  .app.dark .sheet-title { color: #d97706; }

  .sheet-body {
    overflow-y: auto;
    padding: 0.5rem 1.2rem 2rem;
    flex: 1;
  }

  .purport-text {
    font-size: 0.95rem;
    line-height: 1.8;
    white-space: pre-line;
  }

  /* ── Lang picker ── */
  .lang-picker-sheet { max-height: 70vh; }

  .lang-picker-list {
    overflow-y: auto;
    flex: 1;
    padding: 0.3rem 1.2rem 2rem;
  }

  /* ── Share sheet ── */
  .share-body { display: flex; flex-direction: column; gap: 1rem; }

  .share-card {
    background: white;
    border-radius: 16px;
    padding: 1.2rem 1.1rem 1rem;
    box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    border: 1px solid rgba(180, 83, 9, 0.35);
  }
  .app.dark .share-card { background: #1e1b14; border-color: rgba(217, 119, 6, 0.45); }

  .share-devanagari { font-size: 0.85rem; line-height: 1.65; color: #92400e; }
  .app.dark .share-devanagari { color: #d97706; }
  .share-translit { font-size: 0.75rem; font-style: italic; color: #78716c; line-height: 1.5; }
  .app.dark .share-translit { color: #a8a29e; }
  .share-translation { font-size: 0.95rem; line-height: 1.65; }

  .share-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid rgba(0,0,0,0.07);
    padding-top: 0.5rem;
    margin-top: 0.1rem;
  }
  .app.dark .share-footer { border-color: rgba(255,255,255,0.07); }
  .share-ref { font-weight: 700; font-size: 0.75rem; font-family: system-ui, sans-serif; }
  .share-attr { font-size: 0.68rem; color: #b45309; font-family: system-ui, sans-serif; opacity: 0.7; }
  .app.dark .share-attr { color: #d97706; }

  /* Share actions grid */
  .share-actions {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.5rem;
  }

  .share-action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    background: rgba(0,0,0,0.04);
    border: none;
    border-radius: 12px;
    padding: 0.75rem 0.3rem 0.6rem;
    cursor: pointer;
    color: inherit;
    font-family: system-ui, sans-serif;
    font-size: 0.65rem;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.15s;
  }
  .share-action-btn:hover { background: rgba(0,0,0,0.08); }
  .app.dark .share-action-btn { background: rgba(255,255,255,0.06); }
  .app.dark .share-action-btn:hover { background: rgba(255,255,255,0.1); }

  .share-action-icon { font-size: 1.5rem; line-height: 1; }
</style>
