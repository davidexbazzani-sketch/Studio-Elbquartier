import { reducedMotion } from '../../assets/js/capability.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/* ---------- Navigation ---------- */
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Öffnungszeiten ---------- */
const HOURS = { 0: [9, 18], 1: [8, 18], 2: [8, 18], 3: [8, 18], 4: [8, 18], 5: [8, 18], 6: [9, 18] };
const now = new Date();
const hourNow = now.getHours() + now.getMinutes() / 60;
{
  const [o, c] = HOURS[now.getDay()];
  const tomorrow = HOURS[(now.getDay() + 1) % 7];
  const strong = $('#today'), span = $('#today-hours');
  if (hourNow >= o && hourNow < c) { strong.textContent = 'Jetzt geöffnet'; strong.classList.add('is-open'); span.textContent = `bis ${c} Uhr`; }
  else if (hourNow < o) { strong.textContent = 'Heute geöffnet'; span.textContent = `${o}–${c} Uhr`; }
  else { strong.textContent = 'Morgen wieder da'; span.textContent = `ab ${tomorrow[0]} Uhr`; }
  $$('#hours tr').forEach((tr) => tr.classList.toggle('is-today', tr.dataset.days.split(',').includes(String(now.getDay()))));
}

/* ---------- Getränke: kurze Filme mit Wechsel wie eine steigende Flüssigkeit ---------- */
const DRINKS = {
  crema: { name: 'Café Crema', yours: 'Ihr', price: 2.9, note: 'Hausröstung „Elbe“, mit einem Glas Wasser' },
  matcha: { name: 'Matcha Latte', yours: 'Ihr', price: 4.2, note: 'frisch aufgeschlagen, warm oder auf Eis' },
  cappuccino: { name: 'Cappuccino', yours: 'Ihr', price: 3.6, note: 'mit frisch aufgeschäumter Milch' },
  schokolade: { name: 'Heiße Schokolade', yours: 'Ihre', price: 3.8, note: 'aus echter Schokolade, 70 % Kakao' },
};
const IDS = Object.keys(DRINKS);
const IMG = '../../assets/img/cafe/getraenke/';
const VID = '../../assets/video/cafe/';
const HOLD = 900; // so lange bleibt das fertige Getränk stehen, bevor das nächste kommt
const NO_VIDEO = 7000; // Anzeigedauer, falls ein Film nicht abgespielt werden kann
const EASE = 'cubic-bezier(.72,0,.2,1)';
const WAVE_FRONT = 'M0 50C75 22 225 22 300 50S525 78 600 50 825 22 900 50 1125 78 1200 50V100H0Z';
const WAVE_BACK = 'M0 42C75 70 225 70 300 42S525 14 600 42 825 70 900 42 1125 14 1200 42V100H0Z';

const drinks = $('#getraenke');
const stage = $('#drink-stage');
const toggle = $('#drink-toggle');
const tabs = $$('.km-tab', drinks);
const panels = $$('.km-drink', drinks);
const ghosts = $$('.km-drinks__ghost span', drinks);
const rings = Object.fromEntries(tabs.map((t) => [t.dataset.id, $('.km-tab__ring', t)]));
// Ohne Bewegung, im Datensparmodus oder mit ?lite laufen die Filme nur auf Wunsch
const autoplay = !reducedMotion && !navigator.connection?.saveData && !new URLSearchParams(location.search).has('lite');

let current = 0;
let started = false; // erstes Getränk schon eingeblendet?
let inView = false;
let paused = !autoplay; // vom Gast angehalten (oder keine Autowiedergabe)
let dialogOpen = false;
let holdTimer = 0, raf = 0;
let fallback = null; // { start, elapsed } wenn ein Film nicht startet
let z = 1;
let revealToken = 0;
const layers = new Map();

// Namen in Buchstaben zerlegen, damit sie einzeln aufsteigen können
for (const h of $$('.km-drink__name', drinks)) {
  const text = h.textContent.trim();
  h.setAttribute('aria-label', text);
  h.innerHTML = text.split(/\s+/).map((w) => `<span class="w" aria-hidden="true">${[...w].map((c) => `<span class="ch">${c}</span>`).join('')}</span>`).join(' ');
}

function layer(id) {
  let L = layers.get(id);
  if (L) return L;
  const el = document.createElement('div');
  el.className = 'km-layer';
  el.dataset.id = id;
  const wave = (cls, d) => `<svg class="km-wave ${cls}" viewBox="0 0 1200 100" preserveAspectRatio="none"><path d="${d}"/></svg>`;
  el.innerHTML = `<div class="km-layer__mover"><div class="km-layer__wave">${wave('km-wave--back', WAVE_BACK)}${wave('km-wave--front', WAVE_FRONT)}</div>`
    + '<div class="km-layer__clip"><div class="km-layer__inner"><video muted playsinline preload="none" disablepictureinpicture disableremoteplayback></video></div></div></div>'
    + '<div class="km-layer__shade"></div>';
  const video = $('video', el);
  video.muted = true;
  video.poster = IMG + id + (autoplay ? '-start.webp' : '.webp');
  // Posterbild auch dahinter, falls das Video beim Springen kurz kein Bild hat
  $('.km-layer__inner', el).style.backgroundImage = `url("${video.poster}")`;
  video.src = VID + id + '.mp4';
  video.addEventListener('ended', () => { if (IDS[current] === id) ended(); });
  stage.appendChild(el);
  L = { id, el, video, mover: $('.km-layer__mover', el), inner: $('.km-layer__inner', el), shade: $('.km-layer__shade', el), anims: [] };
  layers.set(id, L);
  return L;
}

const settle = (L) => { L.anims.forEach((a) => a.cancel()); L.anims = []; L.el.classList.remove('is-filling'); };

function hide(L) {
  settle(L);
  L.el.classList.remove('is-shown');
  L.video.pause();
  if (L.video.currentTime > 0.05) L.video.currentTime = 0;
}

/** Neues Getränk steigt von unten ins Bild, mit einer Flüssigkeitskante vorneweg */
function reveal(L, prev) {
  const token = ++revealToken;
  for (const other of layers.values()) if (other !== L && other !== prev) hide(other);
  if (prev) settle(prev); // ein noch laufender Wechsel springt ans Ende
  settle(L);
  L.el.classList.add('is-shown');
  L.el.style.zIndex = String(++z);
  const done = () => {
    if (token !== revealToken) return; // inzwischen kam schon der nächste Wechsel
    settle(L);
    if (prev) hide(prev);
  };
  if (reducedMotion) {
    const a = L.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: 'ease-out' });
    L.anims.push(a);
    a.onfinish = done;
    return;
  }
  const opt = { duration: 1250, easing: EASE, fill: 'both' };
  L.el.classList.add('is-filling');
  const a = L.mover.animate([{ transform: 'translateY(103%)' }, { transform: 'translateY(0)' }], opt);
  L.anims.push(a, L.inner.animate([{ transform: 'translateY(-103%) scale(1.14)' }, { transform: 'translateY(0) scale(1)' }], opt));
  if (prev) {
    prev.anims.push(
      prev.inner.animate([{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-9%) scale(1.05)' }], opt),
      prev.shade.animate([{ opacity: 0 }, { opacity: 0.4 }], opt),
    );
  }
  a.onfinish = done;
}

function animateText(panel, prevPanel) {
  panel.fadeOut?.cancel();
  panel.style.visibility = '';
  if (prevPanel && prevPanel !== panel) {
    prevPanel.fadeOut?.cancel();
    prevPanel.style.visibility = 'visible'; // während des Ausblendens noch sichtbar
    const out = prevPanel.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducedMotion ? 150 : 220, easing: 'ease-out', fill: 'forwards' });
    prevPanel.fadeOut = out;
    out.onfinish = () => { prevPanel.style.visibility = ''; out.cancel(); prevPanel.fadeOut = null; };
  }
  if (reducedMotion) {
    panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out', fill: 'backwards' });
    return;
  }
  $$('.ch', panel).forEach((c, i) => c.animate(
    [{ transform: 'translateY(112%)' }, { transform: 'translateY(0)' }],
    { duration: 950, delay: 180 + i * 26, easing: 'cubic-bezier(.2,.75,.1,1)', fill: 'backwards' },
  ));
  [...panel.children].filter((el) => !el.matches('.km-drink__name, .km-drink__img')).forEach((el, i) => el.animate(
    [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }],
    { duration: 800, delay: 300 + i * 80, easing: 'cubic-bezier(.2,.75,.1,1)', fill: 'backwards' },
  ));
}

function setRing(id, p) { rings[id].style.strokeDashoffset = String(1 - Math.max(0, Math.min(1, p))); }

function tick() {
  raf = requestAnimationFrame(tick);
  const id = IDS[current];
  if (fallback) {
    const p = (fallback.elapsed + performance.now() - fallback.start) / NO_VIDEO;
    setRing(id, p);
    if (p >= 1) { stopTick(); fallback = null; next(); }
    return;
  }
  const v = layers.get(id)?.video;
  if (v?.duration) setRing(id, v.currentTime / v.duration);
}
function stopTick() { cancelAnimationFrame(raf); raf = 0; }

function play() {
  if (paused || !inView || dialogOpen || document.hidden || !started) return;
  const L = layer(IDS[current]);
  clearTimeout(holdTimer);
  if (fallback) { fallback.start = performance.now(); }
  else {
    if (L.video.ended) L.video.currentTime = 0;
    const p = L.video.play();
    p?.catch?.((err) => {
      // nur wenn der Browser das Abspielen verweigert (z. B. Stromsparmodus), nicht bei Unterbrechungen
      if (err?.name === 'AbortError' || paused || IDS[current] !== L.id || fallback) return;
      fallback = { start: performance.now(), elapsed: 0 };
      if (!raf) tick();
    });
  }
  if (!raf) tick();
}
function halt() {
  stopTick();
  clearTimeout(holdTimer);
  if (fallback) fallback.elapsed += performance.now() - fallback.start;
  layers.get(IDS[current])?.video.pause();
}

function ended() {
  stopTick();
  setRing(IDS[current], 1);
  if (autoplay && !paused) holdTimer = setTimeout(next, HOLD);
  else setPaused(true); // ohne Autowiedergabe: Film bleibt am Ende stehen
}
const next = () => show(current + 1);

function setPaused(on) {
  paused = on;
  toggle.setAttribute('aria-pressed', String(on));
  if (on) halt(); else play();
}

function show(index) {
  const prevId = IDS[current];
  current = (index + IDS.length) % IDS.length;
  const id = IDS[current];
  if (started && id === prevId) return;
  const first = !started;
  started = true;
  halt();
  fallback = null;
  if (prevId !== id) setRing(prevId, 0);
  setRing(id, 0);
  drinks.dataset.drink = id;
  tabs.forEach((t) => {
    const on = t.dataset.id === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  const prevPanel = panels.find((p) => p.dataset.id === prevId);
  panels.forEach((p) => {
    const on = p.dataset.id === id;
    p.classList.toggle('is-active', on);
    p.inert = !on;
  });
  ghosts.forEach((g) => g.classList.toggle('is-active', g.dataset.id === id));
  const L = layer(id);
  if (L.video.currentTime > 0.05) L.video.currentTime = 0;
  reveal(L, first ? null : layers.get(prevId));
  animateText(panels[current], first ? null : prevPanel);
  // das nächste Getränk schon laden, damit der Wechsel ohne Warten klappt
  if (autoplay) layer(IDS[(current + 1) % IDS.length]).video.preload = 'auto';
  play();
}

/* Bedienung */
tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
$('.km-drinks__tabs', drinks).addEventListener('keydown', (e) => {
  const i = tabs.indexOf(e.target.closest('.km-tab'));
  if (i < 0) return;
  const to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (to === undefined) return;
  e.preventDefault();
  const n = (to + tabs.length) % tabs.length;
  tabs[n].focus();
  show(n);
});
toggle.addEventListener('click', () => setPaused(!paused));
{ // Wischen über das Bild wechselt das Getränk
  let sx = 0, sy = 0, down = false;
  stage.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sy = e.clientY; });
  stage.addEventListener('pointercancel', () => { down = false; });
  stage.addEventListener('pointerup', (e) => {
    if (!down) return;
    down = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) show(current + (dx < 0 ? 1 : -1));
  });
}

// Bühne einschalten (ohne JavaScript bleiben vier Karten mit Bildern)
drinks.classList.add('is-ready');
$('.km-drinks__media', drinks).hidden = false;
$('.km-drinks__tabs', drinks).hidden = false;
panels.forEach((p) => { p.inert = !p.classList.contains('is-active'); });
toggle.setAttribute('aria-pressed', String(paused));
layer(IDS[0]);
new IntersectionObserver(([e]) => {
  inView = e.isIntersecting;
  if (inView && !started) show(0);
  else if (inView) play();
  else halt();
}, { threshold: 0.3 }).observe(stage);
document.addEventListener('visibilitychange', () => { if (document.hidden) halt(); else play(); });

/* ---------- Vorbestellung (Demo) ---------- */
const dlg = $('#order');
const form = $('#order-form');
let pickup = null, orderId = IDS[0];
const hm = (d) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

function slots(at = new Date()) {
  const h = at.getHours() + at.getMinutes() / 60;
  const [o, c] = HOURS[at.getDay()];
  if (h >= o - 0.25 && h < c - 0.5) {
    return [10, 20, 30].map((m) => {
      const t = new Date(at.getTime() + m * 60000);
      t.setMinutes(Math.ceil(t.getMinutes() / 5) * 5, 0, 0);
      return { label: `In ${m} Min.`, sub: `${hm(t)} Uhr`, time: t };
    });
  }
  const day = new Date(at);
  if (h >= c - 0.5) day.setDate(day.getDate() + 1);
  const open = HOURS[day.getDay()][0];
  const word = day.getDate() === at.getDate() ? 'Heute' : 'Morgen';
  return [0, 15, 30].map((m) => {
    const t = new Date(day);
    t.setHours(open, m, 0, 0);
    return { label: word, sub: `${hm(t)} Uhr`, time: t };
  });
}

function openOrder(id) {
  const d = DRINKS[id];
  orderId = id;
  const options = slots();
  pickup = options[0];
  $('#order-title').textContent = d.name;
  $('#order-extras').textContent = d.note;
  $('#order-total').textContent = euro.format(d.price);
  $('#order-time').innerHTML = options.map((s, i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-slot="${i}">${s.label} <small>${s.sub}</small></button>`).join('');
  $('#order-time').onclick = (e) => {
    const b = e.target.closest('[data-slot]');
    if (!b) return;
    pickup = options[+b.dataset.slot];
    $$('[data-slot]', $('#order-time')).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  };
  const status = $('#order-status');
  status.textContent = 'Beispiel-Formular: Es wird nichts gesendet.';
  status.classList.remove('is-ok');
  $('#order-submit').hidden = false;
  $('#order-cancel').textContent = 'Zurück';
  dialogOpen = true;
  halt();
  dlg.showModal();
  document.documentElement.classList.add('is-locked');
}
drinks.addEventListener('click', (e) => {
  const b = e.target.closest('[data-order]');
  if (b) openOrder(b.dataset.order);
});
$('#order-cancel').addEventListener('click', () => dlg.close());
dlg.addEventListener('close', () => {
  document.documentElement.classList.remove('is-locked');
  dialogOpen = false;
  play();
});
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const field = form.name;
  const ok = field.value.trim() !== '';
  field.closest('.km-field').classList.toggle('is-invalid', !ok);
  if (!ok) { field.focus(); return; }
  const d = DRINKS[orderId];
  const code = `M-${10 + Math.floor(Math.random() * 90)}`;
  const status = $('#order-status');
  status.innerHTML = `<strong>Danke, ${field.value.trim().replace(/[<>&]/g, '')}!</strong> ${d.yours} ${d.name} stünde um ${hm(pickup.time)} Uhr an der Theke bereit. Abholnummer: <b>${code}</b><br><small>Beispiel: Es wurde nichts gesendet.</small>`;
  status.classList.add('is-ok');
  $('#order-submit').hidden = true;
  $('#order-cancel').textContent = 'Schließen';
});

/* ---------- Scroll-Animationen ---------- */
function initMotion() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reducedMotion) {
    document.documentElement.classList.remove('js-motion');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });
  gsap.fromTo('[data-hero]:not(.km-hero__media)', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.09, delay: 0.1 });
  gsap.from('.km-hero__media', { y: 26, duration: 1.2, delay: 0.1 }); // Hauptbild nur bewegen, nicht ausblenden (LCP)
  gsap.fromTo('.km-hero__media img', { scale: 1.08 }, { scale: 1, duration: 2.2, ease: 'power2.out' });
  gsap.fromTo('.km-roast__media img', { scale: 1.14 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.km-roast', start: 'top bottom', end: 'center center', scrub: true },
  });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.09, overwrite: true }),
  });
}
initMotion();
