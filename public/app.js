(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const video = $('video');
  video.addEventListener('error', () => { $('video-error').hidden = false; });
  video.addEventListener('canplay', () => { $('video-error').hidden = true; });


  if ('IntersectionObserver' in window) {
    if (!reducedMotion) {
      const reveals = new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.remove('waiting'); reveals.unobserve(entry.target); }
      }), { threshold: 0.06 });
      document.querySelectorAll('.reveal').forEach((element) => { element.classList.add('waiting'); reveals.observe(element); });
    }
    const sectionObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      $('main-nav').querySelectorAll('a').forEach((link) => link.classList.toggle('current', link.hash === `#${entry.target.id}`));
    }), { rootMargin: '-20% 0px -60% 0px' });
    ['dinamica', 'cenas', 'laboratorio', 'metodo'].forEach((id) => sectionObserver.observe($(id)));
  }

  // Expose the short verification phrases without completion tracking.
  if (document.modelContext?.registerTool) {
    const lifecycle = new AbortController();
    const tool = {
      name: 'read_video_investigation', title: 'Ler palavras-chave de verificação',
      description: 'Read the short verification phrases visible on this page. Does not classify or authenticate a video.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Nenhum parâmetro é aceito.');
        const phrases = [...document.querySelectorAll('.method-phrase h3')];
        const text = (element) => element.textContent.replace(/\s+/g, ' ').trim();
        const visible = phrases.filter(phrase => { const r = phrase.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
        return { questions: phrases.map(text), visible: visible.map(text), origin: 'Short prompts for human verification. No automatic authentication is performed.' };
      }
    };
    try { Promise.resolve(document.modelContext.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); }
    catch { /* The page remains usable without this experimental API. */ }
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  }
})();
