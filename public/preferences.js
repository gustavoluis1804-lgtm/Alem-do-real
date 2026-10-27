(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const body = document.body;
  const defaults = { font: 16, line: 26, dark: true, smooth: false };
  let storageAvailable = true;
  function read(key, fallback) {
    try { return localStorage.getItem(key) ?? fallback; }
    catch { storageAvailable = false; return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, String(value)); storageAvailable = true; }
    catch { storageAvailable = false; }
    updateStorageMessage();
  }
  function bounded(value, fallback, min, max) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? Math.round(Math.max(min, Math.min(max, number))) : fallback;
  }
  const preferences = {
    dark: read('alem-real:theme:v4', 'dark') === 'dark',
    smooth: read('smoothMode', 'false') === 'true',
    font: bounded(read('fontSize', '16'), defaults.font, 14, 32),
    line: bounded(read('lineHeight', '26'), defaults.line, 23, 60)
  };
  preferences.line = Math.max(preferences.line, Math.ceil(preferences.font * 1.5));
  function updateStorageMessage() {
    $('preferences-status').textContent = storageAvailable ? 'Suas preferências ficam neste navegador.' : 'Preferências aplicadas nesta página; o navegador não permitiu salvá-las.';
  }
  function applyTheme() {
    body.classList.toggle('darkmode', preferences.dark);
    root.setAttribute('data-theme', preferences.dark ? 'dark' : 'light');
    root.style.colorScheme = preferences.dark ? 'dark' : 'light';
    $('darkmode').classList.toggle('toggled', preferences.dark);
    $('darkmode').setAttribute('aria-pressed', String(preferences.dark));
    $('darkmode').setAttribute('aria-label', preferences.dark ? 'Ativar tema claro' : 'Ativar tema escuro');
    $('theme-label').textContent = preferences.dark ? 'Tema claro' : 'Tema escuro';
    $('menu-theme').textContent = preferences.dark ? 'Usar tema claro' : 'Usar tema escuro';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', preferences.dark ? '#25291f' : '#efefe5');
  }
  function applyTexture() {
    body.classList.toggle('smooth', preferences.smooth);
    $('smooth').setAttribute('aria-pressed', String(preferences.smooth));
    $('rough').setAttribute('aria-pressed', String(!preferences.smooth));
  }
  function applyFont() {
    root.style.setProperty('--fontSize', `${preferences.font}px`);
    root.style.setProperty('--lineHeight', `${preferences.line}px`);
    $('font-value').textContent = `${preferences.font}px`;
    $('font-down').disabled = preferences.font <= 14;
    $('font-up').disabled = preferences.font >= 32;
  }
  const toggleTheme = () => { preferences.dark = !preferences.dark; applyTheme(); save('alem-real:theme:v4', preferences.dark ? 'dark' : 'light'); };
  $('darkmode').addEventListener('click', toggleTheme);
  $('menu-theme').addEventListener('click', toggleTheme);
  $('smooth').addEventListener('click', () => { preferences.smooth = true; applyTexture(); save('smoothMode', true); });
  $('rough').addEventListener('click', () => { preferences.smooth = false; applyTexture(); save('smoothMode', false); });
  function changeFont(delta) {
    preferences.font = bounded(preferences.font + delta, defaults.font, 14, 32);
    preferences.line = Math.round(preferences.font * defaults.line / defaults.font);
    applyFont(); save('fontSize', preferences.font); save('lineHeight', preferences.line);
  }
  $('font-up').addEventListener('click', () => changeFont(1));
  $('font-down').addEventListener('click', () => changeFont(-1));
  $('font-reset').addEventListener('click', () => { preferences.font = defaults.font; preferences.line = defaults.line; applyFont(); save('fontSize', defaults.font); save('lineHeight', defaults.line); });
  applyTheme(); applyTexture(); applyFont(); updateStorageMessage();

  const menu = $('explore-menu');
  let returnFocus = null;
  function openMenu(focusReading = false) {
    if (menu.open) return;
    returnFocus = document.activeElement;
    if (typeof menu.showModal === 'function') menu.showModal();
    else { menu.setAttribute('open', ''); menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-modal', 'true'); }
    body.classList.add('menu'); $('menu').classList.add('toggled'); $('menu').setAttribute('aria-expanded', 'true');
    window.dispatchEvent(new CustomEvent('workshopmenuopen'));
    if (focusReading) $('font-up').focus();
  }
  function closeMenu() {
    if (typeof menu.close === 'function') menu.close();
    else { menu.removeAttribute('open'); afterClose(); }
  }
  function afterClose() {
    body.classList.remove('menu'); $('menu').classList.remove('toggled'); $('menu').setAttribute('aria-expanded', 'false');
    returnFocus?.focus({ preventScroll: true });
  }
  $('menu').addEventListener('click', () => { if (menu.open) closeMenu(); else openMenu(); });
  $('close-menu').addEventListener('click', closeMenu);
  $('open-reading').addEventListener('click', () => openMenu(true));
  menu.addEventListener('close', afterClose);
  menu.addEventListener('click', (event) => {
    if (event.target !== menu) return;
    const box = menu.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeMenu();
  });
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    closeMenu();
    const target = document.getElementById(link.hash.slice(1));
    if (target) { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
  }));

})();
