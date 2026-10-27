(() => {
  'use strict';
  const screen = document.getElementById('bootScreen');
  if (!screen) return;
  const root = document.documentElement;
  const skip = document.getElementById('skip-boot');
  const status = document.getElementById('boot-status');
  const counter = document.getElementById('boot-count');
  const meter = screen.querySelector('[role="progressbar"]');
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
    document.body.classList.contains('motion-paused');
  const started = performance.now();
  const minimum = reduced ? 0 : 1800;
  const background = [];
  let finished = false, frame = 0, completeTimer = 0, hideTimer = 0;
  let displayed = 0, loaded = 0, total = 0, queued = false, lastInteger = -1;

  function paint(value) {
    const percent = Math.max(0, Math.min(100, value));
    screen.style.setProperty('--boot-progress', String(percent / 100));
    screen.style.setProperty('--boot-fill', percent.toFixed(2) + '%');
    const integer = Math.floor(percent);
    if (integer !== lastInteger) {
      lastInteger = integer;
      counter.textContent = String(integer).padStart(3, '0');
      meter.setAttribute('aria-valuenow', String(integer));
    }
  }

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(safetyTimer);
    clearTimeout(completeTimer);
    cancelAnimationFrame(frame);
    paint(100);
    status.textContent = 'Pronto para ir além.';
    screen.classList.add('departing');
    screen.setAttribute('aria-hidden', 'true');
    screen.removeAttribute('aria-modal');
    root.classList.remove('boot-loading');
    background.forEach(([element, wasInert]) => { element.inert = wasInert; });
    if (screen.contains(document.activeElement)) {
      document.querySelector('[data-start-duel]')?.focus({ preventScroll: true });
    }
    hideTimer = setTimeout(() => { screen.hidden = true; }, reduced ? 0 : 850);
    window.WORKSHOP_BOOT_COMPLETE = true;
    window.dispatchEvent(new CustomEvent('workshopbootready'));
  }

  // Opening the page always has a bounded wait, including failed image requests.
  const safetyTimer = setTimeout(finish, 3500);
  skip.addEventListener('click', finish);
  screen.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); finish(); }
    if (event.key === 'Tab') { event.preventDefault(); skip.focus(); }
  });

  function tick(now) {
    if (finished) return;
    const intro = Math.min(1, (now - started) / Math.max(1, minimum));
    const ready = loaded === total;
    const target = ready && intro === 1 ? 100 : Math.min(98, loaded / total * 84 + intro * 14);
    displayed += (target - displayed) * .14;
    paint(displayed);
    if (ready && intro === 1 && displayed >= 99.4 && !queued) {
      queued = true;
      paint(100);
      status.textContent = 'Pronto para ir além.';
      completeTimer = setTimeout(finish, 180);
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  try {
    root.classList.add('boot-loading');
    [...document.body.children].forEach((element) => {
      if (element === screen || ['SCRIPT', 'NOSCRIPT', 'STYLE'].includes(element.tagName)) return;
      background.push([element, element.inert]);
      element.inert = true;
    });
    skip.focus({ preventScroll: true });
    const covers = ['assets/amostra-03.jpg', 'assets/amostra-05.jpg', 'assets/amostra-07.jpg', 'assets/amostra-11.jpg'];
    const tasks = covers.map((src) => new Promise((resolve) => {
      const picture = new Image();
      picture.onload = picture.onerror = resolve;
      picture.src = src;
    }));
    tasks.push(document.fonts?.load('800 1em Inter') || Promise.resolve());
    tasks.push(document.fonts?.load('400 1em Inter') || Promise.resolve());
    total = tasks.length;
    tasks.forEach((task) => Promise.resolve(task).catch(() => {}).then(() => {
      if (finished) return;
      loaded += 1;
      if (loaded === total) {
        status.textContent = 'Abrindo novas perspectivas.';
        if (reduced) finish();
      }
    }));
    frame = requestAnimationFrame(tick);
  } catch {
    finish();
  }

  window.addEventListener('pagehide', () => {
    finish();
    clearTimeout(hideTimer);
    screen.hidden = true;
  }, { once: true });
})();
