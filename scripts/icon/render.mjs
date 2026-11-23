// Dibuja scripts/icon/icon.html a 1024×1024 y guarda dos PNG junto a este fichero:
//   icon-1024-full.png   a sangre (para el icono "maskable" y el de iOS)
//   icon-1024-round.png  esquinas redondeadas con transparencia (icono "any")
// Necesita Playwright (npm i -D playwright; npx playwright install chromium, o PW_CHANNEL=chrome) y la tipografía Tiro Devanagari Sanskrit (OFL, Google Fonts)
// guardada como scripts/icon/TiroDevanagariSanskrit-Regular.ttf. Después: python3 scripts/icon/make_icons.py
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const dir = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL });   // PW_CHANNEL=chrome usa el Chrome instalado
const page = await (await browser.newContext({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 })).newPage();
await page.goto('file://' + dir + '/icon.html');
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: dir + '/icon-1024-full.png' });
await page.evaluate(() => document.getElementById('ic').classList.add('round'));
await page.screenshot({ path: dir + '/icon-1024-round.png', omitBackground: true });
await browser.close();
