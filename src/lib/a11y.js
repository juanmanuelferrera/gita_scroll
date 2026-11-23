// Ayudas de accesibilidad.
/** Svelte action para ventanas modales: lleva el foco dentro, lo mantiene dentro con Tab/Mayús+Tab y lo devuelve al control que la abrió. */
export function trapFocus(node) {
  const opener = document.activeElement;
  const SEL = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  const items = () => [...node.querySelectorAll(SEL)].filter((e) => e.offsetParent !== null);
  node.setAttribute('tabindex', '-1');
  queueMicrotask(() => (items()[0] || node).focus({ preventScroll: true }));
  function onKey(e) {
    if (e.key !== 'Tab') return;
    const f = items();
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === node)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  node.addEventListener('keydown', onKey);
  return { destroy() { node.removeEventListener('keydown', onKey); if (opener && opener.focus) opener.focus({ preventScroll: true }); } };
}
