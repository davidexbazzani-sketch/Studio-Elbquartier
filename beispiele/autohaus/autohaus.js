import { afterInteraction, can3D, reducedMotion } from '../../assets/js/capability.js';
import { CARS, ORDER } from '../../assets/js/3d/cars.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const IMG = '../../assets/img/autohaus/';

/* ---------- Navigation ---------- */
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Intro-Film ---------- */
const video = $('#intro-video');
const filmToggle = $('#film-toggle');
const playFilm = () => video.play().catch(() => {}); // Autoplay kann blockiert sein; dann bleibt das Standbild
filmToggle.addEventListener('click', () => {
  const pause = filmToggle.getAttribute('aria-pressed') !== 'true';
  filmToggle.setAttribute('aria-pressed', String(pause));
  filmToggle.setAttribute('aria-label', pause ? 'Film abspielen' : 'Film anhalten');
  if (pause) video.pause(); else playFilm();
});
if (reducedMotion) {
  filmToggle.setAttribute('aria-pressed', 'true');
  filmToggle.setAttribute('aria-label', 'Film abspielen');
} else {
  // nur abspielen, solange das Intro sichtbar ist
  new IntersectionObserver(([e]) => {
    if (filmToggle.getAttribute('aria-pressed') === 'true') return;
    if (e.isIntersecting) playFilm(); else video.pause();
  }).observe(video);
}

/* ---------- Showroom: Bedienelemente ---------- */
const stage = $('#stage');
const poster = $('#poster');
const progress = $('#progress span');
let carId = ORDER[0];
let paintId = CARS[carId].paint;
let showroom = null;

$('#cars').innerHTML = ORDER.map((id) => {
  const c = CARS[id];
  return `<button type="button" class="hd-car" role="radio" aria-checked="${id === carId}" data-car="${id}"><small>${c.make}</small><span>${c.name}</span></button>`;
}).join('');

function renderPaints() {
  const c = CARS[carId];
  $('#paints').innerHTML = c.paints.map((p) => `
    <button type="button" class="hd-paint${p.kind === 'matte' ? ' is-matte' : ''}" role="radio" aria-checked="${p.id === paintId}"
      data-paint="${p.id}" style="--paint:${p.color}" aria-label="${p.name}" title="${p.name}"></button>`).join('');
  $('#paint-name').textContent = c.paints.find((p) => p.id === paintId).name;
}

function renderInfo() {
  const c = CARS[carId];
  $('#car-make').textContent = c.make;
  $('#car-year').textContent = c.year;
  $('#car-name').textContent = c.name;
  $('#car-type').textContent = c.type;
  $('#car-price').textContent = c.price;
  $('#car-claim').textContent = c.claim;
  $('#car-specs').innerHTML = c.specs.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $$('#cars [data-car]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.car === carId)));
  if (!stage.classList.contains('is-live')) {
    poster.src = `${IMG}${carId}.webp`;
    poster.alt = `${c.make} ${c.name} in ${c.paints.find((p) => p.id === c.paint).name} im Showroom`;
  }
  $('#form-car').value = carId;
}

$('#form-car').innerHTML = ORDER.map((id) => `<option value="${id}">${CARS[id].make} ${CARS[id].name} (${CARS[id].year})</option>`).join('')
  + '<option value="beratung">Noch offen – Beratung gewünscht</option>';

async function chooseCar(id, { scroll = false } = {}) {
  if (scroll) stage.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  if (id === carId && showroom) return;
  carId = id;
  paintId = CARS[id].paint;
  renderInfo();
  renderPaints();
  if (!showroom) return;
  stage.classList.add('is-loading');
  try {
    await showroom.setCar(id, { paint: paintId, onProgress: (f) => { progress.style.width = `${Math.round(f * 100)}%`; } });
  } finally {
    stage.classList.remove('is-loading');
    progress.style.width = '0';
  }
}

$('#cars').addEventListener('click', (e) => {
  const b = e.target.closest('[data-car]');
  if (b) chooseCar(b.dataset.car);
});
$('#paints').addEventListener('click', (e) => {
  const b = e.target.closest('[data-paint]');
  if (!b) return;
  paintId = b.dataset.paint;
  renderPaints();
  showroom?.setPaint(paintId);
});

// Werkzeuge
$('#tools').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b || !showroom) return;
  stage.classList.add('is-touched');
  if (b.dataset.view) return showroom.setView(b.dataset.view);
  const act = b.dataset.act;
  if (act === 'zoom-in') showroom.zoomBy(0.78);
  if (act === 'zoom-out') showroom.zoomBy(1.28);
  if (act === 'reset') showroom.reset();
  if (act === 'spin') {
    const paused = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(paused));
    b.setAttribute('aria-label', paused ? 'Drehscheibe starten' : 'Drehscheibe anhalten');
    showroom.setAutoRotate(!paused);
  }
  if (act === 'full') setFull(b.getAttribute('aria-pressed') !== 'true');
});

function setFull(on) {
  const b = $('[data-act="full"]');
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? 'Vollbild beenden' : 'Vollbild');
  stage.classList.toggle('is-full', on);
  document.documentElement.classList.toggle('is-locked', on);
  showroom?.setFullMode(on);
  $('#hint span').textContent = on
    ? 'Ziehen zum Umrunden · Mausrad oder zwei Finger zum Zoomen'
    : (matchMedia('(pointer: fine)').matches ? 'Ziehen zum Umrunden · Doppelklick fährt heran' : 'Seitlich wischen zum Umrunden · zwei Finger zum Zoomen');
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && stage.classList.contains('is-full')) setFull(false); });

stage.addEventListener('pointerdown', () => stage.classList.add('is-touched'));
if (matchMedia('(pointer: fine)').matches) $('#hint span').textContent = 'Ziehen zum Umrunden · Doppelklick fährt heran';

/* ---------- Showroom: 3D laden ---------- */
async function start3D() {
  $('#load3d').hidden = true;
  stage.classList.add('is-loading');
  try {
    const { createShowroom } = await import('../../assets/js/3d/showroom.js');
    showroom = await createShowroom({ container: $('#stage-canvas'), reducedMotion });
    await showroom.setCar(carId, { paint: paintId, onProgress: (f) => { progress.style.width = `${Math.round(f * 100)}%`; } });
    $('#tools').hidden = false;
    // Licht geht an, sobald man den Showroom betritt
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      stage.classList.add('is-live');
      showroom.lightsOn();
    }, { threshold: 0.35 });
    io.observe(stage);
    // die anderen Fahrzeuge im Hintergrund vorladen
    const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 4000 }) : setTimeout(fn, 2500));
    idle(() => ORDER.filter((id) => id !== carId).reduce((p, id) => p.then(() => showroom.preload(id)), Promise.resolve()));
  } catch (err) {
    console.warn('3D konnte nicht geladen werden:', err);
    $('#load3d-why').textContent = 'Auf diesem Gerät nicht verfügbar.';
    $('#load3d').hidden = false;
  } finally {
    stage.classList.remove('is-loading');
    progress.style.width = '0';
  }
}

renderInfo();
renderPaints();
const cap = can3D();
if (cap.ok) {
  // erst laden, wenn der Showroom kurz vor dem Bildschirm ist (vorher lief das Laden beim ersten Scrollen
  // mitten im Intro an und ließ Film und Seite ruckeln); bis dahin steht das Standbild im Showroom
  const near = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    near.disconnect();
    if (window.requestIdleCallback) requestIdleCallback(() => start3D(), { timeout: 800 }); else start3D();
  }, { rootMargin: '25% 0px' });
  afterInteraction(() => near.observe(stage), { fallback: Infinity, events: ['scroll', 'wheel', 'keydown', 'touchmove'] }); // erst beim Scrollen
} else {
  $('#load3d-why').textContent = cap.why;
  $('#load3d').hidden = false;
  $('#load3d').addEventListener('click', start3D, { once: true });
}

/* ---------- Sammlung ---------- */
const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
$('#cards').innerHTML = ORDER.map((id) => {
  const c = CARS[id];
  const paint = c.paints.find((p) => p.id === c.paint).name;
  return `
  <li class="hd-card" data-reveal>
    <div class="hd-card__media"><img src="${IMG}karte-${id}.webp" width="1200" height="1020" loading="lazy" alt="${c.make} ${c.name} in ${paint}"></div>
    <p class="hd-eyebrow">${c.make} · ${c.year}</p>
    <h3 class="hd-card__name">${c.name}</h3>
    <p class="hd-card__meta">${c.specs.map(([, v]) => v).slice(0, 3).join(' · ')} · ${paint}</p>
    <div class="hd-card__foot">
      <span class="hd-card__price">${c.price}</span>
      <button type="button" class="hd-card__go" data-show="${id}">${arrow}Im Showroom</button>
    </div>
  </li>`;
}).join('');
$('#cards').addEventListener('click', (e) => {
  const b = e.target.closest('[data-show]');
  if (b) chooseCar(b.dataset.show, { scroll: true });
});

/* ---------- Probefahrt (Demo) ---------- */
const form = $('#visit-form');
const dateInput = form.querySelector('[name="datum"]');
const today = new Date();
dateInput.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = form.querySelector('[name="name"]');
  let ok = true;
  [name, dateInput].forEach((f) => {
    const valid = f.value.trim() !== '';
    f.closest('.hd-field').classList.toggle('is-invalid', !valid);
    if (!valid) ok = false;
  });
  const status = $('#visit-status');
  if (!ok) {
    status.textContent = 'Bitte Name und Wunschtermin angeben.';
    status.classList.remove('is-ok');
    return;
  }
  const [y, m, day] = dateInput.value.split('-').map(Number);
  const d = new Date(y, m - 1, day).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const car = form.auto.selectedOptions[0].textContent;
  status.textContent = `Danke, ${name.value.trim()}! Hier käme jetzt die Bestätigung für ${d}: ${car}, ${form.ort.value.charAt(0).toLowerCase() + form.ort.value.slice(1)}. (Beispiel: Es wurde nichts gesendet.)`;
  status.classList.add('is-ok');
  form.reset();
  $('#form-car').value = carId;
});

/* ---------- Bewegung ---------- */
function initMotion() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reducedMotion) {
    document.documentElement.classList.remove('js-motion');
    playFilm();
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });

  // Intro als Motion Graphic: Vorhang öffnet den Film, das Logo zeichnet sich, die Buchstaben setzen sich
  const draws = $$('.hd-draw');
  draws.forEach((el) => {
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
  });
  const tl = gsap.timeline({ delay: 0.15 });
  tl.fromTo('#film', { clipPath: 'inset(49.6% 0% 49.6% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', onStart: playFilm })
    .fromTo('#film video', { scale: 1.18 }, { scale: 1, duration: 2.4, ease: 'power2.out' }, '<')
    .to(draws[0], { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut' }, 0.7)
    .to(draws.slice(1, 3), { strokeDashoffset: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out' }, 1.1)
    .to(draws[3], { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut' }, 1.4)
    .fromTo('.hd-intro__word span', { opacity: 0, y: 18, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.06 }, 1.3)
    .fromTo('.hd-intro__word', { letterSpacing: '0.7em' }, { letterSpacing: '0.42em', duration: 1.6, ease: 'power3.out' }, 1.3)
    .fromTo('.hd-intro__rule', { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power2.inOut' }, 1.9)
    .fromTo('.hd-intro__sub', { opacity: 0, y: 8 }, { opacity: 0.8, y: 0, duration: 0.8 }, 2.2)
    .fromTo('[data-intro]', { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 1.0, stagger: 0.09 }, 1.6);

  // Beim Scrollen: Logo zieht sich zurück, der Film bewegt sich langsamer als die Seite
  gsap.to('#brand', {
    opacity: 0, yPercent: -30, ease: 'none',
    scrollTrigger: { trigger: '.hd-intro', start: 'top top', end: 'bottom 40%', scrub: true },
  });
  gsap.to('#film video', {
    yPercent: 8, ease: 'none',
    scrollTrigger: { trigger: '.hd-intro', start: 'top top', end: 'bottom top', scrub: true },
  });

  // Haltung: Wörter leuchten beim Scrollen nacheinander auf
  const st = $('#statement');
  st.innerHTML = st.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
  gsap.fromTo('#statement .w', { opacity: 0.14 }, {
    opacity: 1, ease: 'none', stagger: 0.06,
    scrollTrigger: { trigger: st, start: 'top 82%', end: 'bottom 45%', scrub: true },
  });

  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.1, overwrite: true }),
  });
}
initMotion();
