/* ---------- Startbereich: fünf Szenen weich überblendet, danach Logo-Animation, Endlosschleife ----------
   Schnell trotz Video:
   - Sofort sichtbar ist nur ein kleines Standbild (erstes Bild von Szene 1), die Videos laden erst nach dem Seitenaufbau.
   - Es laden nie mehr als zwei Videos gleichzeitig (aktuelles + nächstes), Handy bekommt eigene Hochformat-Dateien.
   - Datensparmodus, sehr langsame Verbindung oder „Bewegung reduzieren“: Es bleibt beim Standbild.
   - Außerhalb des Bildschirms oder in einem anderen Tab wird angehalten. Pause-Knopf für alle (Barrierefreiheit). */
import { reducedMotion } from './capability.js';

const hero = document.querySelector('.hero');
const media = hero?.querySelector('.hero__media');
const clips = media ? [...media.querySelectorAll('.hero__clip')] : [];
const sting = media?.querySelector('.hero__sting');
const pauseBtn = hero?.querySelector('.hero__pause');

const SCENES = 5;
const FADE = 0.9; // Sekunden Überblendung (passt zur CSS-Transition)
const STING_MS = 4600; // Dauer der Logo-Szene
const conn = navigator.connection || {};
const sparsam = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');

if (media && clips.length === 2 && sting && !reducedMotion && !sparsam) start();

function start() {
  const portrait = matchMedia('(max-aspect-ratio: 1/1)').matches;
  const src = (i) => `assets/video/hero60/hero-${i + 1}-${portrait ? 'p' : 'l'}.mp4`;

  let cur = clips[0], nxt = clips[1];
  let scene = 0; // 0–4 Videos, 5 = Logo
  let switching = false, paused = false, inView = true, raf = 0, stingTimer = 0, stingLeft = 0, stingStart = 0;

  const load = (v, i) => { v.src = src(i); v.preload = 'auto'; v.load(); };
  const tryPlay = (v) => v.play().catch(() => {}); // z. B. iPhone-Stromsparmodus: dann bleibt das Standbild
  const running = () => !paused && inView && !document.hidden;

  function tick() {
    raf = 0;
    if (!running()) return;
    if (!switching && scene < SCENES && cur.duration && cur.currentTime >= cur.duration - FADE) advance();
    raf = requestAnimationFrame(tick);
  }
  const loop = () => { if (!raf && running()) raf = requestAnimationFrame(tick); };

  function advance() {
    switching = true;
    if (scene < SCENES - 1) {
      // nächste Szene über die aktuelle blenden
      nxt.currentTime = 0;
      tryPlay(nxt);
      nxt.classList.add('is-on');
      cur.classList.remove('is-on');
      setTimeout(() => {
        cur.pause();
        [cur, nxt] = [nxt, cur];
        scene += 1;
        load(nxt, (scene + 1) % SCENES); // übernächste Szene vorladen (nach dem Logo wieder Szene 1)
        switching = false;
      }, FADE * 1000);
    } else {
      // letzte Szene → Logo-Animation, darunter Szene 1 bereitstellen
      scene = SCENES;
      sting.classList.add('is-on');
      hero.classList.add('is-sting'); // Logo unter der Leistungszeile zeichnen
      playSting(STING_MS);
    }
  }

  function playSting(ms) {
    stingStart = performance.now();
    stingLeft = ms;
    clearTimeout(stingTimer);
    stingTimer = setTimeout(endSting, ms);
  }

  function endSting() {
    cur.pause();
    cur.classList.remove('is-on');
    nxt.currentTime = 0;
    tryPlay(nxt);
    nxt.classList.add('is-on');
    sting.classList.remove('is-on');
    hero.classList.remove('is-sting');
    setTimeout(() => {
      [cur, nxt] = [nxt, cur];
      scene = 0;
      load(nxt, 1);
      switching = false;
      loop();
    }, FADE * 1000);
  }

  function setRunning() {
    const on = running();
    hero.classList.toggle('is-paused', !on);
    if (scene === SCENES) {
      // Logo-Szene: Restzeit merken bzw. fortsetzen
      if (!on && stingTimer) { clearTimeout(stingTimer); stingTimer = 0; stingLeft -= performance.now() - stingStart; }
      else if (on && !stingTimer) playSting(Math.max(400, stingLeft));
      return;
    }
    if (on) { if (cur.classList.contains('is-on')) tryPlay(cur); loop(); } else cur.pause();
  }

  // Erstes Video laden, sobald Schriften und erstes Bild stehen (nicht erst nach dem kompletten Seitenaufbau:
  // auf dem Handy dauerte das mehrere Sekunden). Das zweite Video lädt erst, wenn das erste läuft.
  let started = false;
  const go = () => {
    if (!cur.dataset.early) load(cur, 0); // meist schon im HTML angefordert und gestartet (Inline-Skript unter den Videos)
    const first = () => {
      started = true;
      cur.classList.add('is-on');
      hero.classList.add('has-video');
      if (pauseBtn) pauseBtn.hidden = false;
      load(nxt, 1);
      loop();
    };
    if (cur.dataset.playing) first();
    else cur.addEventListener('playing', first, { once: true });
    if (cur.readyState >= 3) { if (running()) tryPlay(cur); }
    else cur.addEventListener('canplay', () => { if (running()) tryPlay(cur); }, { once: true });
  };
  go();

  // iPhone im Stromsparmodus spielt Videos nur nach einer Berührung ab: beim ersten Tippen nachholen
  const unlock = () => {
    if (started) { removeEventListener('touchend', unlock); removeEventListener('click', unlock); return; }
    if (running() && cur.src) tryPlay(cur);
  };
  addEventListener('touchend', unlock, { passive: true });
  addEventListener('click', unlock);

  new IntersectionObserver(([e]) => { inView = e.isIntersecting; setRunning(); }).observe(hero);
  document.addEventListener('visibilitychange', setRunning);
  pauseBtn?.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.setAttribute('aria-label', paused ? 'Hintergrundvideo abspielen' : 'Hintergrundvideo anhalten');
    setRunning();
  });
}
