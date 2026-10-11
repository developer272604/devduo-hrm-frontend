(() => {
  let saved;
  try {
    saved = localStorage.getItem('devduo-theme');
  } catch {}
  const dark =
    saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.add(dark ? 'scheme-dark' : 'scheme-light');
})();
