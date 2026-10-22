/* ---------- Hintergrundfilm im Startbereich (Restaurant, Bar): Clips weich überblendet, Endlosschleife ----------
   - Der erste Clip wird schon im HTML angefordert und startet selbst (Inline-Skript im .film-Block), mit gleichem
     Standbild als Poster: kein schwarzes Bild, kein Warten auf die übrigen Skripte.
   - Der nächste Clip lädt erst, wenn der erste läuft. Handys bekommen eigene Hochformat-Dateien.
   - Datensparmodus, sehr langsame Verbindung oder „Bewegung reduzieren“: Es bleibt beim Standbild.
   - Außerhalb des Bildschirms oder in einem anderen Tab wird angehalten. Pause-Knopf (Barrierefreiheit).
   HTML: <div class="film" data-film data-count="2" data-src="…/film-{n}-{f}.mp4" data-poster="…/film-{n}-{f}.webp"> */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function bgFilm(root) {
  if (!root) return;
  const clips = [...root.querySelectorAll('video')];
  const conn = navigator.connection || {};
  if (reduced || conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '') || clips.length < 2) return;

  const count = Number(root.dataset.count) || 2;
  const fmt = matchMedia('(max-aspect-ratio: 1/1)').matches ? 'p' : 'l';
  const fill = (tpl, i) => tpl.replace('{n}', i + 1).replace('{f}', fmt);
  const FADE = 1.2; // Sekunden, passt zur CSS-Überblendung
  const btn = root.parentElement.querySelector('.film__pause');

  let cur = clips[0], nxt = clips[1], scene = 0;
  let switching = false, paused = false, inView = true, raf = 0, started = false;
  const want = (v, i) => {
    const s = fill(root.dataset.src, i);
    if (v.dataset.clip === s) return; // schon geladen (bei zwei Clips wechseln sie sich einfach ab)
    v.dataset.clip = s;
    v.src = s;
    v.preload = 'auto';
    v.load();
  };
  const play = (v) => v.play().catch(() => {}); // z. B. iPhone-Stromsparmodus: Start beim ersten Tippen (unten)
  const running = () => !paused && inView && !document.hidden;

  function tick() {
    raf = 0;
    if (!running()) return;
    if (!switching && cur.duration && cur.currentTime >= cur.duration - FADE) advance();
    raf = requestAnimationFrame(tick);
  }
  const loop = () => { if (!raf && running()) raf = requestAnimationFrame(tick); };

  function advance() {
    switching = true;
    nxt.currentTime = 0;
    play(nxt);
    nxt.classList.add('is-on');
    cur.classList.remove('is-on');
    setTimeout(() => {
      cur.pause();
      [cur, nxt] = [nxt, cur];
      scene = (scene + 1) % count;
      want(nxt, (scene + 1) % count);
      switching = false;
    }, FADE * 1000);
  }

  function setRunning() {
    const on = running();
    root.classList.toggle('is-paused', !on);
    if (on) { if (started) play(cur); loop(); } else cur.pause();
  }

  // erster Clip: meist schon vom Inline-Skript angefordert
  if (cur.dataset.early) cur.dataset.clip = fill(root.dataset.src, 0);
  else { want(cur, 0); cur.autoplay = true; cur.classList.add('is-on'); }
  const first = () => {
    started = true;
    root.classList.add('is-playing');
    if (btn) btn.hidden = false;
    want(nxt, 1 % count);
    loop();
  };
  if (cur.dataset.playing) first();
  else cur.addEventListener('playing', first, { once: true });
  if (cur.readyState >= 3 && running()) play(cur);

  // iPhone im Stromsparmodus spielt Videos nur nach einer Berührung ab
  const unlock = () => {
    if (started) { removeEventListener('touchend', unlock); removeEventListener('click', unlock); return; }
    if (running()) play(cur);
  };
  addEventListener('touchend', unlock, { passive: true });
  addEventListener('click', unlock);

  new IntersectionObserver(([e]) => { inView = e.isIntersecting; setRunning(); }).observe(root);
  document.addEventListener('visibilitychange', setRunning);
  btn?.addEventListener('click', () => {
    paused = !paused;
    btn.setAttribute('aria-pressed', String(paused));
    btn.setAttribute('aria-label', paused ? 'Hintergrundfilm abspielen' : 'Hintergrundfilm anhalten');
    setRunning();
  });
}
