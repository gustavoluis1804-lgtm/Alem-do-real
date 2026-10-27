(() => {
  'use strict';
  const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const paused = () => reduced.matches || document.body.classList.contains('motion-paused');
  const root = document.documentElement;
  const stage = document.querySelector('.gallery-stage');
  const gallery = document.getElementById('cenas');
  const viewport = document.getElementById('gallery-window');
  const track = document.getElementById('collage-track');
  const cards = [...track.querySelectorAll('.collage-photo')];
  let galleryTrigger = null, galleryProgress = 0;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  function jump(top) {
    const before = root.style.scrollBehavior; root.style.scrollBehavior = 'auto';
    window.scrollTo(0, top); root.style.scrollBehavior = before;
  }
  function updateGallery(progress) {
    galleryProgress = clamp(progress, 0, 1);
    document.getElementById('gallery-progress').style.transform = `scaleX(${galleryProgress})`;
  }
  track.addEventListener('keydown', event => {
    if (!galleryTrigger) return;
    let progress = galleryProgress;
    if (event.key === 'ArrowRight') progress += .14;
    else if (event.key === 'ArrowLeft') progress -= .14;
    else if (event.key === 'Home') progress = 0;
    else if (event.key === 'End') progress = 1;
    else return;
    event.preventDefault();
    window.scrollTo({ top: galleryTrigger.start + clamp(progress, 0, 1) * (galleryTrigger.end - galleryTrigger.start), behavior: 'smooth' });
  });
  updateGallery(0);

  document.querySelectorAll('.roll-label').forEach((label) => {
    const text = label.textContent;
    const original = document.createElement('span'); original.textContent = text;
    const copy = document.createElement('span'); copy.textContent = text; copy.className = 'roll-copy'; copy.setAttribute('aria-hidden', 'true');
    label.replaceChildren(original, copy);
  });
  document.querySelectorAll('[data-word-reveal]').forEach((element) => {
    const words = element.textContent.trim().split(/\s+/);
    element.replaceChildren(...words.flatMap((word, index) => {
      const span = document.createElement('span'); span.className = 'word-reveal'; span.textContent = word;
      return index ? [document.createTextNode(' '), span] : [span];
    }));
  });
  const menuPhotos = [...document.querySelectorAll('.menu-visual img')];
  document.querySelectorAll('.explore-links a').forEach((link, index) => {
    function preview() { menuPhotos.forEach((photo, i) => photo.classList.toggle('active', i === index % menuPhotos.length)); }
    link.addEventListener('pointerenter', preview); link.addEventListener('focus', preview);
  });
  let scrollFrame = 0;
  function pageProgress() {
    scrollFrame = 0;
    const total = root.scrollHeight - innerHeight;
    document.getElementById('page-progress').style.transform = `scaleX(${total > 0 ? clamp(scrollY / total, 0, 1) : 0})`;
    document.querySelector('.site-header').classList.toggle('scrolled', scrollY > 30);
  }
  window.addEventListener('scroll', () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(pageProgress); }, { passive: true });
  window.addEventListener('resize', pageProgress); pageProgress();

  // Anchor transitions keep real URLs, keyboard focus and native wheel scrolling.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(link.hash.slice(1)); if (!target) return;
    event.preventDefault();
    const go = (smooth) => {
      history.pushState(null, '', link.hash);
      if (target.id === 'inicio') {
        if (smooth) window.scrollTo({ top: 0, behavior: 'smooth' }); else jump(0);
      } else if (target.id === 'cenas' && galleryTrigger) {
        if (smooth) window.scrollTo({ top: galleryTrigger.start, behavior: 'smooth' }); else jump(galleryTrigger.start);

      } else if (smooth) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else jump(target.getBoundingClientRect().top + scrollY - 84);
      target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true });
    };
    if (gsap && !paused() && (link.closest('.explore-menu') || link.classList.contains('footer-title'))) {
      gsap.timeline().set('.scene-transition', { yPercent: 101 })
        .to('.scene-transition', { yPercent: 0, duration: .35, ease: 'power3.inOut', onComplete: () => go(false) })
        .to('.scene-transition', { yPercent: -101, duration: .45, ease: 'power3.inOut', delay: .1 })
        .set('.scene-transition', { yPercent: 101 });
    } else go(!paused());
  });
  if (!gsap || !ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  let media = null, hasIntroRun = false;
  function mount() {
    if (media || document.body.classList.contains('motion-paused')) return;
    media = gsap.matchMedia();
    media.add({ motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 900px)', pointer: '(hover: hover) and (pointer: fine)' }, (context) => {
      if (!context.conditions.motion) return;
      const cleanups = [];
      function listen(element, name, fn, options) { element.addEventListener(name, fn, options); cleanups.push(() => element.removeEventListener(name, fn, options)); }
      if (!hasIntroRun) {
        hasIntroRun = true;
        if (scrollY < 100) gsap.timeline({ defaults: { ease: 'power3.out' } })
          .from('.hero-title .title-mask>span', { yPercent: 115, rotation: 5, duration: 1.25, stagger: .14 }, .05)
          .from('.hero-scene canvas', { opacity: 0, scale: .45, rotation: -30, duration: 1.8, ease: 'expo.out' }, .2)
          .from('.site-header', { y: -30, opacity: 0, duration: .8 }, .55);
      }
      const desktop = context.conditions.desktop && context.conditions.pointer;
      if (desktop) {
        gsap.timeline({ scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=70%', pin: true, scrub: .7, anticipatePin: 1 } })
          .to('.hero-title', { yPercent: -12, opacity: .12, ease: 'none' }, 0)
          .to('.hero-scene', { scale: 1.16, rotation: -13, xPercent: -9, yPercent: 9, ease: 'none' }, 0);
      } else {
        gsap.to('.hero-scene', { yPercent: 12, rotation: -7, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .7 } });
      }
      document.querySelectorAll('[data-word-reveal]').forEach((element) => {
        gsap.fromTo(element.querySelectorAll('.word-reveal'), { opacity: .19 }, { opacity: 1, stagger: .15, ease: 'none', scrollTrigger: { trigger: element, start: 'top 80%', end: 'bottom 45%', scrub: .4 } });
      });
      document.querySelectorAll('[data-title-reveal]').forEach((element) => {
        if (element.closest('#laboratorio')) {
          gsap.from(element, { y: 38, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 94%', once: true } });
          return;
        }
        gsap.from(element, { y: 55, opacity: 0, clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'power3.out', scrollTrigger: { trigger: element, start: 'top 94%', once: true } });
      });
      // Preserve the earlier scroll choreography around the new photo frames.
      const perception = document.getElementById('percepcao');
      perception.classList.add('perception-scroll-motion');
      cleanups.push(() => perception.classList.remove('perception-scroll-motion'));
      document.querySelectorAll('.wall-photo').forEach((photo, index) => {
        const speed = Number(photo.dataset.speed) * (desktop ? 1 : .45);
        gsap.fromTo(photo.querySelector('.wall-photo-motion'), { y: speed, rotation: index % 2 ? 8 : -8 }, { y: -speed, rotation: index % 2 ? -3 : 3, ease: 'none', scrollTrigger: { trigger: photo, start: 'top bottom+=100', end: 'bottom top-=100', scrub: .8 } });
        gsap.fromTo(photo.querySelector('img'), { scale: 1.08 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: photo, start: 'top bottom', end: 'bottom top', scrub: .7 } });
      });
      gsap.to('.perception-backdrop', { opacity: .18, scale: .9, ease: 'none', scrollTrigger: { trigger: perception, start: '65% center', end: 'bottom 45%', scrub: .7 } });
      gsap.from('.duel-card', { y: 55, opacity: 0, duration: 1, stagger: .13, ease: 'power3.out', scrollTrigger: { trigger: '.split-experience', start: 'top 85%', once: true } });
      document.querySelectorAll('.duel-photo').forEach((photo) => gsap.fromTo(photo, { yPercent: -3 }, { yPercent: 3, ease: 'none', scrollTrigger: { trigger: photo.parentElement, start: 'top bottom', end: 'bottom top', scrub: .8 } }));
      // One vertical page scroll drives the collage on mouse and touch devices.
      gallery.classList.add('gallery-pinned'); track.scrollLeft = 0;
      const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
      const tween = gsap.fromTo(track, { x: 0 }, { x: () => -distance(), ease: 'none', scrollTrigger: {
        trigger: stage, start: 'top top', end: () => '+=' + Math.max(innerHeight * .8, distance() * 1.1),
        pin: true, scrub: .5, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate(self) {
          updateGallery(self.progress);
          cards.forEach(photo => gsap.set(photo, { y: (self.progress - .5) * Number(photo.dataset.depth || 0) }));
        }
      }});
      galleryTrigger = tween.scrollTrigger;
      cleanups.push(() => {
        galleryTrigger = null; gallery.classList.remove('gallery-pinned');
        gsap.set(cards, { clearProps: 'transform' }); track.scrollLeft = 0;
      });
      // Move the complete frame so the video, border and controls stay together.
      gsap.fromTo('#laboratorio .lab-video-frame', { y: 36, scale: .965 }, { y: 0, scale: 1, ease: 'none', scrollTrigger: { trigger: '#laboratorio .video-showcase', start: 'top 92%', end: 'top 45%', scrub: .7 } });
      const method = document.getElementById('metodo');
      method.classList.add('method-scroll-motion');
      cleanups.push(() => method.classList.remove('method-scroll-motion'));
      method.querySelectorAll('.method-phrase').forEach((phrase, index) => {
        const speed = Number(phrase.dataset.speed) * (desktop ? 1 : .45);
        gsap.fromTo(phrase.querySelector('.method-phrase-motion'), {
          y: speed, rotation: index % 2 ? 8 : -8
        }, {
          y: -speed, rotation: index % 2 ? -3 : 3, ease: 'none',
          scrollTrigger: { trigger: phrase, start: 'top bottom+=100', end: 'bottom top-=100', scrub: .8 }
        });
      });
      gsap.to('.method-backdrop', {
        opacity: .12, scale: .9, ease: 'none',
        scrollTrigger: { trigger: method, start: 'top top', end: '35% center', scrub: .7 }
      });
      gsap.from('.footer-title', { yPercent: 65, rotation: 3, ease: 'none', scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: .65 } });
      listen(window, 'workshopmenuopen', () => {
        document.getElementById('custom-cursor').style.opacity = '0';
        gsap.fromTo('.explore-links a', { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .06, delay: .15, ease: 'power3.out', overwrite: true });
        gsap.fromTo('.menu-visual img', { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: .09, delay: .1, ease: 'power3.out', overwrite: true });
        gsap.fromTo('.reading-settings', { y: 25, opacity: 0 }, { y: 0, opacity: 1, duration: .7, delay: .3, overwrite: true });
      });
      if (context.conditions.pointer) {
        document.querySelectorAll('.magnetic').forEach((button) => {
          const xTo = gsap.quickTo(button, 'x', { duration: .5, ease: 'power3.out' });
          const yTo = gsap.quickTo(button, 'y', { duration: .5, ease: 'power3.out' });
          listen(button, 'pointermove', (event) => { const r = button.getBoundingClientRect(); xTo((event.clientX - r.left - r.width / 2) * .12); yTo((event.clientY - r.top - r.height / 2) * .16); });
          listen(button, 'pointerleave', () => { xTo(0); yTo(0); });
        });
        const cursor = document.getElementById('custom-cursor');
        const x = gsap.quickTo(cursor, 'x', { duration: .3, ease: 'power3.out' }), y = gsap.quickTo(cursor, 'y', { duration: .3, ease: 'power3.out' });
        gsap.set(cursor, { xPercent: -50, yPercent: -50, scale: .5 });
        document.querySelectorAll('[data-cursor]').forEach((area) => {
          listen(area, 'pointerenter', (event) => {
            if (document.querySelector('dialog[open]')) return;
            cursor.textContent = area.dataset.cursor; x(event.clientX); y(event.clientY);
            gsap.to(cursor, { opacity: 1, scale: 1, duration: .25, overwrite: 'auto' });
          });
          listen(area, 'pointermove', (event) => { x(event.clientX); y(event.clientY); });
          listen(area, 'pointerleave', () => gsap.to(cursor, { opacity: 0, scale: .5, duration: .25, overwrite: 'auto' }));
        });
        cleanups.push(() => { gsap.set(cursor, { opacity: 0 }); });
      }
      return () => cleanups.forEach((cleanup) => cleanup());
    });
    requestAnimationFrame(() => ScrollTrigger.refresh());
  }
  function resetMotion() {
    const rect = gallery.getBoundingClientRect();
    const method = document.getElementById('metodo');
    const methodRect = method.getBoundingClientRect();
    const readingMethod = window.WORKSHOP_BOOT_COMPLETE && methodRect.top < innerHeight * .3 && methodRect.bottom > innerHeight * .3;
    const visiblePhrases = [...method.querySelectorAll('.method-phrase')].filter(phrase => {
      const r = phrase.getBoundingClientRect(); return r.bottom > 90 && r.top < innerHeight;
    });
    const methodAnchor = visiblePhrases.sort((a, b) => Math.abs(a.getBoundingClientRect().top - innerHeight * .45) - Math.abs(b.getBoundingClientRect().top - innerHeight * .45))[0] || document.getElementById('method-title');
    const methodAnchorTop = methodAnchor.getBoundingClientRect().top;
    const readingGallery = window.WORKSHOP_BOOT_COMPLETE && rect.top < innerHeight * .3 && rect.bottom > innerHeight * .3;
    const progress = galleryProgress;
    media?.revert(); media = null;
    if (window.WORKSHOP_BOOT_COMPLETE) mount();
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      if (readingGallery) {
        if (galleryTrigger) jump(galleryTrigger.start + progress * (galleryTrigger.end - galleryTrigger.start));
        else jump(gallery.getBoundingClientRect().top + scrollY - 100);
        updateGallery(progress);
      } else if (readingMethod) {
        jump(methodAnchor.getBoundingClientRect().top + scrollY - methodAnchorTop);
      }
      pageProgress();
    });
  }
  if (window.WORKSHOP_BOOT_COMPLETE) mount();
  window.addEventListener('workshopbootready', mount, { once: true });
  window.addEventListener('workshopmotionchange', resetMotion);
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  document.fonts?.ready.then(() => ScrollTrigger.refresh()).catch(() => {});
  window.addEventListener('pagehide', () => { media?.revert(); media = null; });
  window.addEventListener('pageshow', (event) => { if (event.persisted) mount(); });
})();
