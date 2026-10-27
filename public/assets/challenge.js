(() => {
  'use strict';
  const rounds = window.WORKSHOP_ROUNDS;
  const $ = (id) => document.getElementById(id);
  const dialog = $('challenge-dialog');
  const body = $('challenge-body');
  const resultKey = 'alem-real:duelLast:v3';
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let state;
  let returnFocus;
  let roundEvents;
  let playbackTimers = [];
  let activeVideos = [];
  let generation = 0;

  function pauseVideos() { document.querySelectorAll('video').forEach((video) => video.pause()); }
  function disposeRound() {
    generation += 1;
    roundEvents?.abort();
    playbackTimers.forEach(clearTimeout);
    playbackTimers = [];
    activeVideos.forEach((video) => video.pause());
    activeVideos = [];
  }
  function shufflePair(samples) {
    const pair = samples.slice();
    const random = new Uint32Array(1);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(random);
    else random[0] = Math.floor(Math.random() * 2);
    if (random[0] % 2) pair.reverse();
    return pair;
  }
  function event(target, name, callback) { target.addEventListener(name, callback, { signal: roundEvents.signal }); }
  function sourceCard(sample, letter = '') {
    return `<article class="media-source ${sample.isAI ? 'synthetic' : 'recorded'}"><div class="source-label"><b>${letter ? 'Amostra ' + letter + ' · ' : ''}${sample.origin}</b><span>${sample.isAI ? 'IA' : 'Câmera'}</span></div><h4>${escape(sample.title)}</h4><p>${escape(sample.detail)}</p><p class="source-credit">${escape(sample.credit)} · ${escape(sample.date)}<br>${escape(sample.license)}</p><div class="source-links"><a href="${escape(sample.url)}" target="_blank" rel="noopener">Conferir a fonte ↗</a><a href="${escape(sample.licenseUrl)}" target="_blank" rel="noopener">Licença ↗</a>${sample.primaryUrl ? `<a href="${escape(sample.primaryUrl)}" target="_blank" rel="noopener">Publicação da OpenAI ↗</a>` : ''}</div><small>Recorte de 5 s; enquadramento 16:9, 960 × 540, 30 fps e áudio removido.</small></article>`;
  }
  function showRound() {
    disposeRound();
    roundEvents = new AbortController();
    const round = rounds[state.index];
    const pair = state.pairs[state.index];
    state.selected = null;
    state.confidence = '';
    state.revealed = false;
    state.watched = [false, false];
    $('challenge-progress').innerHTML = rounds.map((_, index) => `<span class="${index < state.index ? 'done' : index === state.index ? 'current' : ''}"></span>`).join('');
    $('challenge-progress').setAttribute('aria-label', `Rodada ${state.index + 1} de ${rounds.length}`);
    const titleParts = round.titleParts || [round.title.slice(0, round.title.lastIndexOf(' ')), round.title.slice(round.title.lastIndexOf(' ') + 1)];
    body.innerHTML = `<div class="round-heading"><div class="round-number"><span>RODADA ${String(state.index + 1).padStart(2, '0')} / ${String(rounds.length).padStart(2, '0')}</span>${round.level === 'advanced' ? '<small>NÍVEL AVANÇADO</small>' : ''}</div><h3 id="round-title" tabindex="-1" aria-label="${escape(round.title)}"><span>${escape(titleParts[0])}</span><em>${escape(titleParts[1])}</em></h3><p>${escape(round.focus)}</p><div class="quiz-scene" aria-hidden="true"><img src="assets/quiz-skyline.jpg" alt="" width="1600" height="1066"></div></div>
    <div class="video-duo" role="group" aria-label="Compare as amostras A e B e escolha qual foi gerada por IA">${pair.map((sample, index) => `<article class="sample-card" data-sample="${index}"><div class="sample-top"><b>${index ? 'B' : 'A'}</b><span>AMOSTRA ${index ? 'B' : 'A'}</span><span class="watch-state" id="watch-${index}">Assista primeiro <i aria-hidden="true">▶</i></span></div><div class="sample-screen"><video controls playsinline preload="metadata" poster="${sample.poster}" aria-label="Amostra ${index ? 'B' : 'A'} da rodada ${state.index + 1}"><source src="${sample.src}" type="video/mp4">Seu navegador não reproduz este vídeo.</video><span class="sample-loading" hidden>Carregando vídeo<span class="loading-dot"></span></span></div><div class="sample-error" hidden><p>Não foi possível carregar esta amostra.</p><button type="button" class="text-button" data-retry="${index}">Tentar novamente</button><a href="${sample.src}" download>Baixar vídeo</a></div><div class="watch-track" aria-hidden="true"><span></span></div><button type="button" class="sample-vote" data-vote="${index}" aria-pressed="false" disabled><span class="vote-indicator" aria-hidden="true"></span><span class="vote-label">Escolher ${index ? 'B' : 'A'} como IA</span></button></article>`).join('')}</div>
    <div class="round-tools"><button type="button" class="button lime" id="play-pair"><span aria-hidden="true">▶</span> Reproduzir os dois</button><button type="button" class="button outline" id="replay-pair"><span class="replay-icon" aria-hidden="true">⟳</span> Rever vídeos</button><p id="watch-status" role="status">Assista a pelo menos 3,5 segundos de cada vídeo para votar.</p></div>
    <div class="vote-bar"><fieldset class="confidence"><legend>Qual é sua confiança? <small>Opcional</small></legend><div>${['Baixa', 'Média', 'Alta'].map((value) => `<button type="button" data-confidence="${value}" aria-pressed="false">${value}</button>`).join('')}</div></fieldset><div class="vote-confirm"><span id="choice-status" role="status">Um vídeo é real. O outro foi gerado por IA.</span><button type="button" class="button lime" id="choice-submit" disabled>Revelar a resposta <span aria-hidden="true">→</span></button></div></div><section class="duel-reveal" id="duel-reveal" hidden aria-labelledby="reveal-title"></section>`;
    activeVideos = Array.from(body.querySelectorAll('video'));
    activeVideos.forEach((video, index) => {
      const card = body.querySelector(`[data-sample="${index}"]`);
      const loading = card.querySelector('.sample-loading');
      const error = card.querySelector('.sample-error');
      const clearWaiting = () => { loading.hidden = true; error.hidden = true; };
      event(video, 'waiting', () => { loading.hidden = false; });
      event(video, 'playing', clearWaiting);
      event(video, 'canplay', clearWaiting);
      event(video, 'loadeddata', clearWaiting);
      event(video, 'error', () => {
        loading.hidden = true; error.hidden = false;
        $('watch-status').textContent = 'Carregue os dois vídeos para completar a comparação.';
      });
      event(video, 'timeupdate', () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;
        card.querySelector('.watch-track span').style.width = `${Math.min(100, video.currentTime / video.duration * 100)}%`;
        let played = 0;
        for (let i = 0; i < video.played.length; i += 1) played += video.played.end(i) - video.played.start(i);
        if (played >= Math.min(3.5, video.duration * 0.7)) {
          state.watched[index] = true;
          $('watch-' + index).textContent = 'Observado ✓';
          updateVote();
        }
      });
      event(card.querySelector('[data-retry]'), 'click', () => {
        error.hidden = true; loading.hidden = false;
        video.load();
        video.play().catch(() => { loading.hidden = true; });
      });
    });
    event($('play-pair'), 'click', () => playPair(false));
    event($('replay-pair'), 'click', () => playPair(true));
    body.querySelectorAll('[data-vote]').forEach((button) => event(button, 'click', () => {
      if (state.revealed || !state.watched.every(Boolean)) return;
      state.selected = Number(button.dataset.vote);
      body.querySelectorAll('[data-vote]').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
        item.closest('.sample-card').classList.toggle('is-selected', item === button);
      });
      updateVote();
    }));
    body.querySelectorAll('[data-confidence]').forEach((button) => event(button, 'click', () => {
      if (state.revealed) return;
      state.confidence = button.dataset.confidence;
      body.querySelectorAll('[data-confidence]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    }));
    event($('choice-submit'), 'click', () => {
      if (state.revealed) {
        advanceRound();
      } else reveal();
    });
    dialog.scrollTop = 0;
    $('round-title').focus({ preventScroll: true });
  }
  async function playPair(rewind) {
    const currentGeneration = generation;
    const videos = activeVideos.slice();
    if (rewind) videos.forEach((video) => { video.currentTime = 0; });
    const results = await Promise.allSettled(videos.map((video) => video.play()));
    if (currentGeneration !== generation) { videos.forEach((video) => video.pause()); return; }
    if (results.some((result) => result.status === 'rejected')) $('watch-status').textContent = 'Toque em reproduzir em cada player para assistir.';
  }
  function updateVote() {
    const ready = state.watched.every(Boolean);
    body.querySelectorAll('[data-vote]').forEach((button) => { button.disabled = !ready || state.revealed; });
    $('choice-submit').disabled = !state.revealed && (!ready || state.selected === null);
    if (state.revealed) return;
    if (ready) $('watch-status').textContent = 'Os dois vídeos foram observados. Qual deles foi gerado por IA?';
    if (state.selected !== null) $('choice-status').textContent = `Você escolheu a amostra ${state.selected ? 'B' : 'A'} como IA.`;
  }
  function reveal() {
    if (state.revealed || state.selected === null || !state.watched.every(Boolean)) return;
    const round = rounds[state.index];
    state.revealed = true;
    activeVideos.forEach((video) => video.pause());
    const pair = state.pairs[state.index];
    const correctIndex = pair.findIndex((sample) => sample.isAI);
    const correct = correctIndex === state.selected;
    pair.forEach((sample, index) => {
      const card = body.querySelector(`[data-sample="${index}"]`);
      card.dataset.origin = sample.isAI ? 'synthetic' : 'recorded';
      card.querySelector('.vote-label').textContent = `Amostra ${index ? 'B' : 'A'} · ${sample.isAI ? 'Gerada por IA' : 'Filmagem real'}`;
    });
    if (correct) state.score += 1;
    state.results.push({ round: state.index + 1, correct, chosen: state.selected ? 'B' : 'A', answer: correctIndex ? 'B' : 'A', confidence: state.confidence || 'Não informada' });
    body.querySelectorAll('[data-confidence]').forEach((button) => { button.disabled = true; });
    const revealArea = $('duel-reveal');
    revealArea.innerHTML = `<div class="reveal-heading"><span class="result-symbol" aria-hidden="true">${correct ? '✓' : '↻'}</span><div><span class="eyebrow">${correct ? 'VOCÊ ACERTOU' : 'OLHE MAIS UMA VEZ'}</span><h3 id="reveal-title" tabindex="-1">A amostra ${correctIndex ? 'B' : 'A'} foi gerada por IA.</h3><p>${correct ? 'Seu palpite coincide com a origem publicada.' : 'Esta cena foi criada por IA, mesmo com aparência de filmagem.'} Sua confiança: ${escape(state.confidence || 'não informada')}.</p></div></div>${round.observation ? `<p class="round-observation">${escape(round.observation)}</p>` : ''}<div class="reveal-sources">${pair.map((sample, index) => sourceCard(sample, index ? 'B' : 'A')).join('')}</div><p class="source-note">Sinais visuais ajudam a investigar. Aqui, a resposta se baseia na origem registrada nas fontes, e não em um detector automático.</p><div class="reveal-actions"><button type="button" class="button lime reveal-next" id="reveal-next">${state.index + 1 < rounds.length ? 'Próxima rodada →' : 'Ver meu resultado →'}</button></div>`;
    revealArea.hidden = false;
    event($('reveal-next'), 'click', advanceRound);
    $('choice-submit').textContent = state.index + 1 < rounds.length ? 'Próxima rodada →' : 'Ver meu resultado →';
    $('choice-status').textContent = `${state.score} acerto${state.score === 1 ? '' : 's'} em ${state.index + 1} rodada${state.index ? 's' : ''}.`;
    updateVote();
    $('reveal-title').focus({ preventScroll: true });
    revealArea.scrollIntoView({ block: 'nearest', behavior: motionReduced() ? 'auto' : 'smooth' });
  }
  function advanceRound() {
    if (!state.revealed) return;
    if (state.index + 1 < rounds.length) { state.index += 1; showRound(); }
    else finish();
  }
  function finish() {
    disposeRound();
    roundEvents = new AbortController();
    const result = { score: state.score, total: rounds.length, results: state.results, date: new Date().toISOString() };
    let saved = true;
    try { localStorage.setItem(resultKey, JSON.stringify(result)); } catch { saved = false; }
    updateLastResult();
    $('challenge-progress').innerHTML = rounds.map(() => '<span class="done"></span>').join('');
    $('challenge-progress').setAttribute('aria-label', 'Desafio concluído');
    body.innerHTML = `<div class="duel-finish"><span class="eyebrow">DESAFIO CONCLUÍDO</span><div class="result-score"><b>${state.score}</b><span>/${rounds.length}</span></div><h3 id="result-title" tabindex="-1">${state.score === rounds.length ? 'Você foi além da primeira impressão.' : 'O olhar aprende. A fonte confirma.'}</h3><p>Você identificou a IA em ${state.score} de ${rounds.length} rodadas. Cenas plausíveis também podem ser inventadas. Antes de compartilhar, confira quem publicou, de onde veio e em qual contexto.</p><div class="result-rounds">${state.results.map((item, index) => `<div><span>${String(index + 1).padStart(2, '0')} · ${escape(rounds[index].title)}</span><b>${item.correct ? 'Acertou ✓' : 'Resposta: ' + item.answer}</b><small>Sua escolha: ${item.chosen} · Confiança: ${escape(item.confidence)}</small></div>`).join('')}</div><div class="finish-actions"><button type="button" class="button lime" id="play-again">Jogar novamente ↗</button><button type="button" class="button outline" id="download-result">Baixar resultado</button><a class="text-button" href="CREDITOS-VIDEOS.md" target="_blank" rel="noopener">Conferir todas as fontes ↗</a></div><p class="source-note">${saved ? 'Este resultado fica apenas neste navegador.' : 'O navegador não permitiu salvar. Baixe o resultado para guardar.'} As posições A e B são embaralhadas a cada nova participação.</p></div>`;
    event($('play-again'), 'click', start);
    event($('download-result'), 'click', () => {
      const text = ['ALÉM DO REAL — GRUPO 3', 'Desafio: IA ou real?', `Resultado: ${state.score}/${rounds.length}`, '', ...state.results.flatMap((item, index) => [rounds[index].title, `Sua escolha: ${item.chosen}; IA: ${item.answer}; ${item.correct ? 'acertou' : 'errou'}; confiança: ${item.confidence}`, ...rounds[index].samples.map((sample) => `${sample.origin}: ${sample.title} — ${sample.credit} — ${sample.url}`), '']), 'Respostas baseadas nas origens publicadas. Os recortes têm 5 segundos, foram reenquadrados, redimensionados e tiveram o áudio removido.'].join('\n');
      const url = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = 'Resultado_Grupo_3.txt'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    dialog.scrollTop = 0;
    $('result-title').focus({ preventScroll: true });
  }
  function start() {
    state = { index: 0, score: 0, results: [], pairs: rounds.map((round) => shufflePair(round.samples)) };
    pauseVideos();
    if (!dialog.open) {
      returnFocus = document.activeElement;
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else { dialog.setAttribute('open', ''); dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); }
    }
    showRound();
  }
  function afterClose() { disposeRound(); returnFocus?.focus({ preventScroll: true }); }
  function close() {
    if (typeof dialog.close === 'function') dialog.close();
    else { dialog.removeAttribute('open'); afterClose(); }
  }
  function updateLastResult() {
    let result = null;
    try { result = JSON.parse(localStorage.getItem(resultKey)); } catch { /* Local persistence is optional. */ }
    if (result && Number.isInteger(result.score) && result.score >= 0 && result.score <= rounds.length && result.total === rounds.length) $('last-duel-result').textContent = `Sua última participação: ${result.score}/${rounds.length}.`;
  }
  document.querySelectorAll('[data-start-duel]').forEach((button) => button.addEventListener('click', start));
  $('close-challenge').addEventListener('click', close);
  dialog.addEventListener('close', afterClose);
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseVideos(); });
  window.addEventListener('pagehide', () => { disposeRound(); pauseVideos(); });
  updateLastResult();

  function motionReduced() { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.body.classList.contains('motion-paused'); }
  let paused = false;
  try { paused = localStorage.getItem('alem-real:motion-paused') === 'true'; } catch { /* Keep the default. */ }
  function applyMotionPreference() {
    document.body.classList.toggle('motion-paused', paused);
    $('motion-toggle').setAttribute('aria-pressed', String(paused));
    $('motion-toggle').textContent = paused ? 'Retomar animações' : 'Pausar animações';
    window.dispatchEvent(new CustomEvent('workshopmotionchange'));
  }
  $('motion-toggle').addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem('alem-real:motion-paused', String(paused)); } catch { /* Preference still works in memory. */ }
    applyMotionPreference();
  });
  applyMotionPreference();

})();
