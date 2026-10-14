import { reducedMotion } from '../../assets/js/capability.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
document.documentElement.classList.add('nf-js');

/* ---------- Navigation ---------- */
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Geöffnet? ---------- */
// Stunden ab Mitternacht des Öffnungstages, 25 = 1 Uhr nachts
const HOURS = { 2: [19, 25], 3: [19, 25], 4: [19, 25], 5: [19, 27], 6: [19, 27] };
const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function openState(now = new Date()) {
  const d = now.getDay(), h = now.getHours() + now.getMinutes() / 60;
  const prev = HOURS[(d + 6) % 7];
  if (prev && h < prev[1] - 24) return { open: true, text: `Jetzt geöffnet · bis ${prev[1] - 24} Uhr`, short: `Bis ${prev[1] - 24} Uhr offen` };
  const today = HOURS[d];
  if (today && h >= today[0]) return { open: true, text: `Jetzt geöffnet · bis ${today[1] % 24} Uhr`, short: `Bis ${today[1] % 24} Uhr offen` };
  if (today) return { open: false, text: `Heute ab ${today[0]} Uhr geöffnet`, short: `Heute ab ${today[0]} Uhr` };
  for (let i = 1; i <= 7; i++) {
    const n = (d + i) % 7;
    if (HOURS[n]) return { open: false, text: `Ruhetag · ${i === 1 ? 'morgen' : DAYS[n]} ab ${HOURS[n][0]} Uhr`, short: 'Heute Ruhetag' };
  }
  return { open: false, text: '', short: '' };
}
const status = $('#status');
const state = openState();
status.classList.toggle('is-open', state.open);
$('.nf-status__long', status).textContent = state.text;
$('.nf-status__short', status).textContent = state.short;
const now = new Date();
const barDay = now.getHours() < 5 ? (now.getDay() + 6) % 7 : now.getDay(); // nach Mitternacht zählt der Vortag
$(`#hours tr[data-day="${barDay}"]`)?.classList.add('is-today');

/* ---------- Karte: Auswahl beim Scrollen ---------- */
const stageEl = $('#stage');
const entries = $$('.nf-drink');
const ids = entries.map((el) => el.dataset.drink);
const nameOf = (i) => $('.nf-drink__pick', entries[i]).textContent;
const wide = matchMedia('(min-width: 960px)');
let current = 0;
let showTimer = 0;

entries[0].classList.add('is-active');

/** Höhe, an der ein Eintrag „aktiv" wird: Bildmitte, mobil die Mitte unter der Bühne. */
function focusLine() {
  if (wide.matches) return innerHeight * 0.5;
  const bottom = Math.max(0, stageEl.getBoundingClientRect().bottom);
  return bottom + (innerHeight - bottom) * 0.42;
}

function select(i) {
  if (i === current) return;
  current = i;
  entries.forEach((el, k) => el.classList.toggle('is-active', k === i));
  $('#stage-num').textContent = String(i + 1).padStart(2, '0');
  $('#stage-title').textContent = nameOf(i);
  clearTimeout(showTimer); // beim schnellen Scrollen nicht jeden Drink einzeln einblenden
  showTimer = setTimeout(() => { if (live) reveal(ids[current]); }, 140);
}

function pickByScroll() {
  const y = focusLine();
  let best = current, bestD = Infinity;
  entries.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    if (d < bestD) { bestD = d; best = i; }
  });
  select(best);
}
let ticking = false;
addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { ticking = false; pickByScroll(); });
}, { passive: true });
addEventListener('resize', pickByScroll);

$('#drinks').addEventListener('click', (e) => {
  const btn = e.target.closest('.nf-drink__pick');
  if (!btn) return;
  const el = btn.closest('.nf-drink');
  const r = el.getBoundingClientRect();
  window.scrollTo({ top: window.scrollY + r.top + r.height / 2 - focusLine(), behavior: reducedMotion ? 'auto' : 'smooth' });
  select(entries.indexOf(el));
});

/* ---------- Bühne: ein kurzer Film je Drink, Wechsel mit einer Iris aus der Glasmitte ---------- */
const view = $('#stage-view');
const note = $('#stage-note');
const playBtn = $('#stage-pause');
const FILM = (id) => `../../assets/video/bar/${id}.mp4`;
const STILL = (id, start) => `../../assets/img/bar/drinks/${id}${start ? '-start' : ''}.webp`;
// Farbe des Leuchtrands je Drink (RGB)
const GLOW = { nachtfalter: '185 150 225', elbtonic: '205 228 245', negroni: '255 138 76', espresso: '230 181 110', mule: '232 150 96', holunder: '184 226 120' };
const EASE = 'cubic-bezier(.62,0,.18,1)';
const lite = new URLSearchParams(location.search).has('lite') || !!navigator.connection?.saveData;
// Ohne Bewegung oder in der leichten Ansicht laufen die Filme nur auf Wunsch
let autoplay = !reducedMotion && !lite;
let live = false, inView = false, userPaused = false, shownId = null, zTop = 1, token = 0;
const films = new Map();
const iris = document.createElement('div');
iris.className = 'nf-iris';

function film(id) {
  let F = films.get(id);
  if (F) return F;
  const el = document.createElement('div');
  el.className = 'nf-film';
  el.innerHTML = '<div class="nf-film__inner"><video muted playsinline preload="none" disablepictureinpicture disableremoteplayback></video></div><div class="nf-film__shade"></div>';
  const video = $('video', el);
  video.muted = true;
  video.poster = STILL(id, autoplay);
  $('.nf-film__inner', el).style.backgroundImage = `url("${video.poster}")`; // falls der Film beim Springen kurz kein Bild hat
  video.src = FILM(id);
  ['play', 'pause', 'ended'].forEach((ev) => video.addEventListener(ev, () => { if (id === shownId) syncButton(); }));
  view.insertBefore(el, iris);
  F = { id, el, video, inner: $('.nf-film__inner', el), shade: $('.nf-film__shade', el), anims: [] };
  films.set(id, F);
  return F;
}

const settle = (F) => { F.anims.forEach((a) => a.cancel()); F.anims = []; };
function hideFilm(F) {
  settle(F);
  F.el.classList.remove('is-shown');
  F.video.pause();
  if (F.video.currentTime > 0.05) F.video.currentTime = 0;
}

function syncButton() {
  const v = films.get(shownId)?.video;
  const playing = !!v && !v.paused && !v.ended;
  playBtn.setAttribute('aria-pressed', String(!playing));
  $('.visually-hidden', playBtn).textContent = playing ? 'Film anhalten' : 'Film abspielen';
}

function play() {
  const F = films.get(shownId);
  if (!F || !autoplay || userPaused || !inView || document.hidden) return;
  if (F.video.ended) F.video.currentTime = 0;
  F.video.play()?.catch(() => syncButton());
}

/** Neuer Drink: Kreis öffnet sich aus der Glasmitte, mit leuchtendem Rand in der Farbe des Drinks */
function reveal(id, instant = false) {
  if (id === shownId) return;
  const F = film(id);
  const prev = shownId ? films.get(shownId) : null;
  const t = ++token;
  for (const other of films.values()) if (other !== F && other !== prev) hideFilm(other);
  settle(F);
  if (prev) { settle(prev); prev.video.pause(); }
  F.el.classList.add('is-shown');
  F.el.style.zIndex = String(++zTop);
  if (F.video.currentTime > 0.05) F.video.currentTime = 0;
  shownId = id;
  syncButton();
  const done = () => {
    if (t !== token) return;
    settle(F);
    if (prev) hideFilm(prev);
    stageEl.classList.add('is-live'); // das Standbild aus dem HTML wird nicht mehr gebraucht
  };
  if (instant) { done(); play(); return; }
  if (reducedMotion) {
    const a = F.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' });
    F.anims.push(a);
    a.onfinish = done;
    play();
    return;
  }
  const w = view.clientWidth, h = view.clientHeight;
  const cx = w / 2, cy = h * 0.56;
  const R = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 2;
  const opt = { duration: 1150, easing: EASE, fill: 'both' };
  const a = F.el.animate([{ clipPath: `circle(0px at ${cx}px ${cy}px)` }, { clipPath: `circle(${R}px at ${cx}px ${cy}px)` }], opt);
  F.anims.push(a, F.inner.animate([{ transform: 'scale(1.24)' }, { transform: 'scale(1)' }], opt));
  if (prev) { // beim ersten Film liegt das Standbild darunter
    prev.anims.push(
      prev.inner.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.9)' }], opt),
      prev.shade.animate([{ opacity: 0 }, { opacity: 0.6 }], opt),
    );
  }
  // der Rand wächst genau mit dem Kreis und verglüht am Ende
  iris.style.cssText = `width:${2 * R}px;height:${2 * R}px;left:${cx - R}px;top:${cy - R}px;z-index:${zTop + 1}`;
  iris.style.setProperty('--glow', GLOW[id] || '230 181 110');
  F.anims.push(iris.animate([
    { transform: 'scale(0)', opacity: 1 },
    { transform: 'scale(0.72)', opacity: 1, offset: 0.72 },
    { transform: 'scale(1)', opacity: 0 },
  ], opt));
  a.onfinish = done;
  play();
}

function goLive() {
  if (live) return;
  live = true;
  view.appendChild(iris);
  // schon sichtbar: der erste Film geht per Iris aus dem Standbild auf, sonst ohne Übergang
  const r = stageEl.getBoundingClientRect();
  reveal(ids[current], !(r.bottom > 0 && r.top < innerHeight && !document.hidden));
  playBtn.hidden = false;
  syncButton();
}

playBtn.addEventListener('click', () => {
  const v = films.get(shownId)?.video;
  if (!v) return;
  if (!v.paused && !v.ended) { userPaused = true; v.pause(); return; }
  userPaused = false;
  autoplay = true; // auf Wunsch spielen die Filme ab jetzt auch in der ruhigen Ansicht
  if (v.ended) v.currentTime = 0;
  v.play()?.catch(() => syncButton());
});

if (lite) {
  note.hidden = false;
  note.textContent = 'Leichte Ansicht: ein Bild je Drink.';
  const more = document.createElement('button');
  more.type = 'button';
  more.textContent = 'Filme abspielen';
  more.addEventListener('click', () => { note.hidden = true; autoplay = true; userPaused = false; play(); });
  note.appendChild(more);
}
new IntersectionObserver((list) => {
  if (list.some((e) => e.isIntersecting)) goLive();
}, { rootMargin: '600px 0px' }).observe(stageEl);
new IntersectionObserver(([e]) => {
  inView = e.isIntersecting;
  if (inView) play(); else films.get(shownId)?.video.pause();
}, { threshold: 0.25 }).observe(stageEl);
document.addEventListener('visibilitychange', () => { if (document.hidden) films.get(shownId)?.video.pause(); else play(); });
pickByScroll();

/* ---------- Scroll-Animationen ---------- */
function initMotion() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reducedMotion) {
    document.documentElement.classList.remove('js-motion');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });
  gsap.fromTo('[data-hero]', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.09, delay: 0.15 });
  gsap.fromTo('.nf-hero__media img', { scale: 1.12 }, { scale: 1, duration: 2.6, ease: 'power2.out' });
  gsap.to('.nf-hero__media img', {
    yPercent: 10, ease: 'none',
    scrollTrigger: { trigger: '.nf-hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.1, overwrite: true }),
  });
}
initMotion();
