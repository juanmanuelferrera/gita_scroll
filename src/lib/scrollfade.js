// Marca con data-more="1" un contenedor con scroll mientras queda texto por debajo: el CSS pinta entonces un degradado al pie (pista de «hay más»).
export function scrollFade(node) {
  const update = () => { node.dataset.more = node.scrollHeight - node.scrollTop - node.clientHeight > 4 ? '1' : '0'; };
  const later = () => requestAnimationFrame(update);
  node.addEventListener('scroll', update, { passive: true });
  const ro = new ResizeObserver(later); ro.observe(node);
  const mo = new MutationObserver(later); mo.observe(node, { childList: true, subtree: true, characterData: true });
  window.addEventListener('resize', later);
  later();
  return { destroy() { node.removeEventListener('scroll', update); ro.disconnect(); mo.disconnect(); window.removeEventListener('resize', later); } };
}
