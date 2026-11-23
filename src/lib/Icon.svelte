<script>
  // Iconos de línea (trazo de 2, extremos redondos, color = el del texto). Sustituyen a los emoji, que cambian de aspecto en cada plataforma.
  let { name, size = 18 } = $props();
  const P = {
    flame: '<path d="M12 3c.4 2.9 3.6 4.7 3.6 8.3a3.6 3.6 0 0 1-7.2 0c0-1.3.5-2.2 1.2-3 .3 1 .8 1.6 1.5 1.9C11.2 8.5 11.8 5.9 12 3z"/><path d="M12 20.5a6 6 0 0 0 6-6c0-1.6-.6-3-1.6-4.2M12 20.5a6 6 0 0 1-6-6c0-1.2.4-2.3 1-3.2"/>',
    cloud: '<path d="M7 18.5a4.2 4.2 0 0 1-.7-8.3A5.6 5.6 0 0 1 17 8.7a4.9 4.9 0 0 1 .6 9.8H7z"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17.2l5-4.4 3.4 3 3-2.6 4.6 4"/>',
    share: '<path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
    chat: '<path d="M20 12a8 8 0 0 1-11.7 7.1L4 20.2l1.1-4A8 8 0 1 1 20 12z"/>',
    send: '<path d="M21 3L10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3z"/>',
  };
</script>

<svg class="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html P[name]}</svg>

<style>
  .ico { flex-shrink: 0; vertical-align: -0.2em; }
</style>
