// Idiomas de la app: etiquetas BCP-47, escritura de derecha a izquierda y textos de la interfaz de LECTURA.
// Los textos de Profile (copia en la nube, instalar, reiniciar…) siguen en inglés y van marcados lang="en".
// Los nombres de capítulo salen de los nombres establecidos de vedabase.cc (src/lib/chapter-names.json).
// ⚠ Los textos de la interfaz de aquí abajo son traducciones breves hechas sin revisión de un lector nativo.
import CHAPTERS from './chapter-names.json' with { type: 'json' };

export const LANG_TAG = { en: 'en', es: 'es', pt: 'pt', hi: 'hi', bn: 'bn', zh: 'zh', bul: 'bg', fr: 'fr', ru: 'ru', ar: 'ar' };
export const RTL = new Set(['ar']);
export const NON_LATIN = new Set(['hi', 'bn', 'zh', 'ar']);   // sin cursiva sintética (esas escrituras no tienen cursiva)

const EN = {
  home: 'Home', gita: 'Gita', profile: 'Profile', mainNav: 'Main navigation',
  todayVerse: "TODAY'S VERSE", today: 'Today', purport: 'Purport',
  swipe: 'Swipe up for the next verse', language: 'Language', ch: 'Ch {n}', loading: 'Loading…',
  bookmark: 'Bookmark', share: 'Share', nextVerse: 'Next verse', prevVerse: 'Previous verse',
  changeLanguage: 'Change language', toggleTheme: 'Toggle theme', selectChapter: 'Select chapter',
  selectVerse: 'Select verse', selectLanguage: 'Select language', close: 'Close', goToday: "Go to today's verse",
  shareVerse: 'Share verse', progress: 'Reading progress',
};
const L = {
  en: EN,
  es: { home: 'Inicio', gita: 'Gita', profile: 'Perfil', mainNav: 'Navegación principal', todayVerse: 'VERSO DE HOY', today: 'Hoy', purport: 'Significado',
    swipe: 'Desliza hacia arriba para el siguiente verso', language: 'Idioma', ch: 'Cap. {n}', loading: 'Cargando…', bookmark: 'Marcador', share: 'Compartir',
    nextVerse: 'Verso siguiente', prevVerse: 'Verso anterior', changeLanguage: 'Cambiar idioma', toggleTheme: 'Cambiar tema', selectChapter: 'Elegir capítulo',
    selectVerse: 'Elegir verso', selectLanguage: 'Elegir idioma', close: 'Cerrar', goToday: 'Ir al verso de hoy', shareVerse: 'Compartir verso', progress: 'Progreso de lectura' },
  pt: { home: 'Início', gita: 'Gita', profile: 'Perfil', mainNav: 'Navegação principal', todayVerse: 'VERSO DE HOJE', today: 'Hoje', purport: 'Significado',
    swipe: 'Deslize para cima para o próximo verso', language: 'Idioma', ch: 'Cap. {n}', loading: 'Carregando…', bookmark: 'Favorito', share: 'Compartilhar',
    nextVerse: 'Próximo verso', prevVerse: 'Verso anterior', changeLanguage: 'Mudar idioma', toggleTheme: 'Alternar tema', selectChapter: 'Escolher capítulo',
    selectVerse: 'Escolher verso', selectLanguage: 'Escolher idioma', close: 'Fechar', goToday: 'Ir ao verso de hoje', shareVerse: 'Compartilhar verso', progress: 'Progresso da leitura' },
  fr: { home: 'Accueil', gita: 'Gita', profile: 'Profil', mainNav: 'Navigation principale', todayVerse: 'VERSET DU JOUR', today: "Aujourd'hui", purport: 'Explication',
    swipe: 'Glissez vers le haut pour le verset suivant', language: 'Langue', ch: 'Chap. {n}', loading: 'Chargement…', bookmark: 'Marque-page', share: 'Partager',
    nextVerse: 'Verset suivant', prevVerse: 'Verset précédent', changeLanguage: 'Changer de langue', toggleTheme: 'Changer de thème', selectChapter: 'Choisir le chapitre',
    selectVerse: 'Choisir le verset', selectLanguage: 'Choisir la langue', close: 'Fermer', goToday: 'Aller au verset du jour', shareVerse: 'Partager le verset', progress: 'Progression de la lecture' },
  ru: { home: 'Главная', gita: 'Гита', profile: 'Профиль', mainNav: 'Основная навигация', todayVerse: 'СТИХ ДНЯ', today: 'Сегодня', purport: 'Комментарий',
    swipe: 'Проведите вверх — следующий стих', language: 'Язык', ch: 'Гл. {n}', loading: 'Загрузка…', bookmark: 'Закладка', share: 'Поделиться',
    nextVerse: 'Следующий стих', prevVerse: 'Предыдущий стих', changeLanguage: 'Сменить язык', toggleTheme: 'Сменить тему', selectChapter: 'Выбрать главу',
    selectVerse: 'Выбрать стих', selectLanguage: 'Выбрать язык', close: 'Закрыть', goToday: 'К стиху дня', shareVerse: 'Поделиться стихом', progress: 'Прогресс чтения' },
  bul: { home: 'Начало', gita: 'Гита', profile: 'Профил', mainNav: 'Основна навигация', todayVerse: 'СТИХ НА ДЕНЯ', today: 'Днес', purport: 'Пояснение',
    swipe: 'Плъзнете нагоре за следващия стих', language: 'Език', ch: 'Гл. {n}', loading: 'Зареждане…', bookmark: 'Отметка', share: 'Споделяне',
    nextVerse: 'Следващ стих', prevVerse: 'Предишен стих', changeLanguage: 'Смяна на езика', toggleTheme: 'Смяна на темата', selectChapter: 'Избор на глава',
    selectVerse: 'Избор на стих', selectLanguage: 'Избор на език', close: 'Затваряне', goToday: 'Към стиха на деня', shareVerse: 'Споделяне на стих', progress: 'Напредък в четенето' },
  hi: { home: 'होम', gita: 'गीता', profile: 'प्रोफ़ाइल', mainNav: 'मुख्य नेविगेशन', todayVerse: 'आज का श्लोक', today: 'आज', purport: 'तात्पर्य',
    swipe: 'अगले श्लोक के लिए ऊपर स्वाइप करें', language: 'भाषा', ch: 'अ. {n}', loading: 'लोड हो रहा है…', bookmark: 'बुकमार्क', share: 'साझा करें',
    nextVerse: 'अगला श्लोक', prevVerse: 'पिछला श्लोक', changeLanguage: 'भाषा बदलें', toggleTheme: 'थीम बदलें', selectChapter: 'अध्याय चुनें',
    selectVerse: 'श्लोक चुनें', selectLanguage: 'भाषा चुनें', close: 'बंद करें', goToday: 'आज के श्लोक पर जाएँ', shareVerse: 'श्लोक साझा करें', progress: 'पढ़ने की प्रगति' },
  bn: { home: 'হোম', gita: 'গীতা', profile: 'প্রোফাইল', mainNav: 'প্রধান নেভিগেশন', todayVerse: 'আজকের শ্লোক', today: 'আজ', purport: 'তাৎপর্য',
    swipe: 'পরের শ্লোকের জন্য উপরে সোয়াইপ করুন', language: 'ভাষা', ch: 'অ. {n}', loading: 'লোড হচ্ছে…', bookmark: 'বুকমার্ক', share: 'শেয়ার করুন',
    nextVerse: 'পরের শ্লোক', prevVerse: 'আগের শ্লোক', changeLanguage: 'ভাষা পরিবর্তন', toggleTheme: 'থিম পরিবর্তন', selectChapter: 'অধ্যায় বেছে নিন',
    selectVerse: 'শ্লোক বেছে নিন', selectLanguage: 'ভাষা বেছে নিন', close: 'বন্ধ করুন', goToday: 'আজকের শ্লোকে যান', shareVerse: 'শ্লোক শেয়ার করুন', progress: 'পড়ার অগ্রগতি' },
  zh: { home: '首页', gita: '薄伽梵歌', profile: '我的', mainNav: '主导航', todayVerse: '今日诗节', today: '今天', purport: '要旨',
    swipe: '向上滑动查看下一节', language: '语言', ch: '第{n}章', loading: '加载中…', bookmark: '书签', share: '分享',
    nextVerse: '下一节', prevVerse: '上一节', changeLanguage: '切换语言', toggleTheme: '切换主题', selectChapter: '选择章节',
    selectVerse: '选择诗节', selectLanguage: '选择语言', close: '关闭', goToday: '前往今日诗节', shareVerse: '分享诗节', progress: '阅读进度' },
  ar: { home: 'الرئيسية', gita: 'الغيتا', profile: 'الملف الشخصي', mainNav: 'التنقل الرئيسي', todayVerse: 'آية اليوم', today: 'اليوم', purport: 'الشرح',
    swipe: 'اسحب للأعلى للآية التالية', language: 'اللغة', ch: 'الفصل {n}', loading: 'جارٍ التحميل…', bookmark: 'إشارة مرجعية', share: 'مشاركة',
    nextVerse: 'الآية التالية', prevVerse: 'الآية السابقة', changeLanguage: 'تغيير اللغة', toggleTheme: 'تبديل السمة', selectChapter: 'اختر الفصل',
    selectVerse: 'اختر الآية', selectLanguage: 'اختر اللغة', close: 'إغلاق', goToday: 'الانتقال إلى آية اليوم', shareVerse: 'مشاركة الآية', progress: 'تقدم القراءة' },
};

/** Texto de la interfaz en `lang`; si falta la clave, inglés. `vars` rellena {n}. */
export function ui(lang, key, vars) {
  let s = (L[lang] && L[lang][key]) || EN[key] || key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}
/** Nombre del capítulo n (1–18): los de vedabase.cc en cada idioma; en inglés, los cortos de la app (`en`). */
export function chapterName(lang, n, en) { return (CHAPTERS[lang] && CHAPTERS[lang][n - 1]) || en; }
