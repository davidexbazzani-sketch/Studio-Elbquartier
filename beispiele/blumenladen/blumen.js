import { can3D, reducedMotion } from '../../assets/js/capability.js';
import { createFlatBouquet, icon } from './bouquet-2d.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/* ---------- Sortiment ---------- */
const FLOWERS = {
  rose: {
    name: 'Rosen', one: 'Rose', price: 4.5, max: 15,
    colors: {
      rose: { label: 'Rosa', sw: '#e88aa0', palette: { base: '#c94f6e', tip: '#ec9db0', edge: '#f5c9d3' } },
      pfirsich: { label: 'Apricot', sw: '#f3c9a0', palette: { base: '#d9774f', tip: '#f6c2a4', edge: '#fcdfcf' } },
      creme: { label: 'Creme', sw: '#f1e3cd', palette: { base: '#d8bf98', tip: '#f6ecdb', edge: '#fffaf1' } },
      rot: { label: 'Samtrot', sw: '#8e1424', palette: { base: '#7a0c22', tip: '#b4203a', edge: '#cc3d52' } },
    },
  },
  peony: {
    name: 'Pfingstrosen', one: 'Pfingstrose', price: 6.9, max: 9,
    colors: {
      blush: { label: 'Altrosa', sw: '#d9a6bd', palette: { base: '#e7a1b0', tip: '#f8d9de', edge: '#fdf0f2' } },
      weiss: { label: 'Weiß', sw: '#f5ede5', palette: { base: '#e9d8c6', tip: '#fbf6f0', edge: '#ffffff' } },
      koralle: { label: 'Koralle', sw: '#f0907e', palette: { base: '#dc6450', tip: '#f4ab9b', edge: '#fad3c9' } },
    },
  },
  tulip: {
    name: 'Tulpen', one: 'Tulpe', price: 2.4, max: 15,
    colors: {
      rot: { label: 'Rot', sw: '#e0432c', palette: { base: '#c8341f', tip: '#ef6a4c' } },
      rosa: { label: 'Rosa', sw: '#f19db3', palette: { base: '#e2708c', tip: '#f6b6c5' } },
      weiss: { label: 'Weiß', sw: '#f4f1e6', palette: { base: '#d9dcc0', tip: '#fbf8f0' } },
      gelb: { label: 'Gelb', sw: '#f2cf5e', palette: { base: '#e5ab22', tip: '#f8df8a' } },
      flieder: { label: 'Flieder', sw: '#c7b0df', palette: { base: '#9a78c6', tip: '#d9c8ee' } },
    },
  },
  eucalyptus: { name: 'Eukalyptus', one: 'Eukalyptus', price: 3.2, max: 8, note: 'Silver Dollar, duftet frisch' },
  gypsophila: { name: 'Schleierkraut', one: 'Schleierkraut', price: 3.5, max: 8, note: 'Leicht wie eine Wolke' },
  lavender: { name: 'Lavendel', one: 'Lavendel', price: 1.4, max: 15, note: 'Aus der Provence, getrocknet hält er ewig' },
};
const ORDER = ['rose', 'peony', 'tulip', 'eucalyptus', 'gypsophila', 'lavender'];
const PAPERS = {
  kraft: { label: 'Kraftpapier', short: 'Kraft', price: 0, sw: '#c69d74' },
  creme: { label: 'Seidenpapier Creme', short: 'Seide Creme', price: 1.5, sw: '#f3ebdf' },
  rose: { label: 'Seidenpapier Rosé', short: 'Seide Rosé', price: 1.5, sw: '#efd3cc' },
};
const RIBBONS = {
  salbei: { label: 'Salbei', sw: '#8fa387' },
  rose: { label: 'Rosé', sw: '#dca59d' },
  creme: { label: 'Creme', sw: '#eee2cf' },
  bordeaux: { label: 'Bordeaux', sw: '#7c2a3a' },
};
const DELIVERY = {
  pickup: { label: 'Abholung im Laden', price: 0 },
  delivery: { label: 'Lieferung in Hamburg', price: 8.9 },
};
const BINDING = 4.0;
const CARD = 2.5;
const MAX_STEMS = 36;

const PRESETS = {
  ottensen: {
    name: 'Strauß „Ottensen“', img: 'strauss-ottensen', alt: 'Strauß aus Pfingstrosen, Rosen, Levkojen und Eukalyptus in Kraftpapier',
    desc: 'Helle Pfingstrosen und Rosen in Pfirsich mit Eukalyptus und Schleierkraut.',
    counts: { peony: 2, rose: 5, eucalyptus: 4, gypsophila: 2 }, colors: { peony: 'weiss', rose: 'pfirsich' }, paper: 'kraft', ribbon: 'creme',
  },
  elbfruehling: {
    name: '„Elbfrühling“', img: 'strauss-elbfruehling', alt: 'Rosa Tulpen in braunem Papier',
    desc: 'Zwölf rosa Tulpen, schlicht in Kraftpapier gewickelt.',
    counts: { tulip: 12 }, colors: { tulip: 'rosa' }, paper: 'kraft', ribbon: 'rose',
  },
  spaetsommer: {
    name: '„Spätsommer“', img: 'strauss-spaetsommer', alt: 'Bunter Spätsommerstrauß mit Dahlie in Kraftpapier, gehalten in einer Hand',
    desc: 'Kräftiges Rot und Violett mit viel Grün, locker gebunden.',
    counts: { rose: 5, lavender: 8, eucalyptus: 3, gypsophila: 1 }, colors: { rose: 'rot' }, paper: 'kraft', ribbon: 'bordeaux',
  },
  pfingstrosen: {
    name: '„Weiße Pfingstrosen“', img: 'strauss-pfingstrosen', alt: 'Weiße Pfingstrosen in Kraftpapier, gehalten in einer Hand',
    desc: 'Fünf weiße Pfingstrosen mit etwas Eukalyptus. Der Klassiker.',
    counts: { peony: 5, eucalyptus: 2 }, colors: { peony: 'weiss' }, paper: 'kraft', ribbon: 'creme',
  },
};

/* ---------- Zustand ---------- */
const state = {
  counts: { rose: 5, peony: 3, tulip: 0, eucalyptus: 3, gypsophila: 2, lavender: 0 },
  colors: { rose: 'rose', peony: 'blush', tulip: 'rosa' },
  paper: 'kraft',
  ribbon: 'salbei',
  card: false,
  delivery: 'pickup',
};

const totalStems = (s = state) => Object.values(s.counts).reduce((a, b) => a + b, 0);
const paletteOf = (type, s = state) => FLOWERS[type].colors?.[s.colors[type]]?.palette || {};

function price(s = state) {
  const lines = [];
  let total = 0;
  for (const type of ORDER) {
    const n = s.counts[type] || 0;
    if (!n) continue;
    const f = FLOWERS[type];
    const colour = f.colors ? ` ${f.colors[s.colors[type]].label}` : '';
    lines.push([`${n} × ${n === 1 ? f.one : f.name}${colour}`, n * f.price]);
    total += n * f.price;
  }
  if (totalStems(s)) {
    lines.push(['Binden von Hand', BINDING]);
    total += BINDING;
    if (PAPERS[s.paper].price) { lines.push([PAPERS[s.paper].label, PAPERS[s.paper].price]); total += PAPERS[s.paper].price; }
    if (s.card) { lines.push(['Grußkarte', CARD]); total += CARD; }
    if (DELIVERY[s.delivery].price) { lines.push([DELIVERY[s.delivery].label, DELIVERY[s.delivery].price]); total += DELIVERY[s.delivery].price; }
  }
  return { lines, total: Math.round(total * 100) / 100 };
}

function stemsOf(s = state) {
  const out = [];
  for (const type of ORDER) {
    for (let i = 0; i < (s.counts[type] || 0); i++) {
      out.push({ id: `${type}-${i}`, key: `${type}:${s.colors[type] || ''}`, type, palette: paletteOf(type, s) });
    }
  }
  return out;
}

/* ---------- Navigation & Ticker ---------- */
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
addEventListener('scroll', onScroll, { passive: true });
onScroll();
const ticker = $('#ticker');
ticker.innerHTML += ticker.innerHTML; // nahtlose Schleife

/* ---------- Sträuße der Woche ---------- */
const binden = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21v-9M12 12c-2.8-.7-4.5-2.5-4.8-5 2.5.2 4.3 2 4.8 5zM12 12c2.8-.7 4.5-2.5 4.8-5-2.5.2-4.3 2-4.8 5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
$('#week').innerHTML = Object.entries(PRESETS).map(([id, p]) => `
  <li class="bk-card" data-reveal>
    <div class="bk-card__media"><img src="../../assets/img/blumen/${p.img}.webp" width="900" height="1125" loading="lazy" alt="${p.alt}"></div>
    <h3 class="bk-card__name">${p.name}</h3>
    <p class="bk-card__desc">${p.desc}</p>
    <div class="bk-card__foot">
      <span class="bk-card__price">${euro.format(price({ ...state, ...p, counts: p.counts, colors: { ...state.colors, ...p.colors }, card: false, delivery: 'pickup' }).total)}</span>
      <button type="button" class="bk-card__btn" data-preset="${id}">${binden}Ähnlich binden</button>
    </div>
  </li>`).join('');

$('#week').addEventListener('click', (e) => {
  const b = e.target.closest('[data-preset]');
  if (!b) return;
  const p = PRESETS[b.dataset.preset];
  state.counts = Object.fromEntries(ORDER.map((t) => [t, p.counts[t] || 0]));
  state.colors = { ...state.colors, ...p.colors };
  state.paper = p.paper;
  state.ribbon = p.ribbon;
  render();
  $('#binden').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
});

/* ---------- Konfigurator: Liste ---------- */
const list = $('#cfg-flowers');
list.innerHTML = ORDER.map((type) => {
  const f = FLOWERS[type];
  const colours = f.colors
    ? `<div class="bk-colors" role="group" aria-label="Farbe der ${f.name}">${Object.entries(f.colors).map(([key, c]) =>
      `<button type="button" style="--sw:${c.sw}" data-color="${key}" aria-label="${c.label}" title="${c.label}"></button>`).join('')}</div>`
    : `<small class="t-micro" style="color:var(--b-ink-3)">${f.note}</small>`;
  return `
    <li class="bk-flower" data-type="${type}">
      <div class="bk-flower__icon"></div>
      <div class="bk-flower__info">
        <span class="bk-flower__name">${f.name}<small>${euro.format(f.price)} / Stiel</small></span>
        ${colours}
      </div>
      <div class="bk-stepper">
        <button type="button" data-step="-1" aria-label="${f.one} weniger">−</button>
        <output aria-live="polite">0</output>
        <button type="button" data-step="1" aria-label="${f.one} mehr">+</button>
      </div>
    </li>`;
}).join('');

list.addEventListener('click', (e) => {
  const row = e.target.closest('.bk-flower');
  if (!row) return;
  const type = row.dataset.type;
  const step = e.target.closest('[data-step]');
  const colour = e.target.closest('[data-color]');
  if (step) {
    const d = Number(step.dataset.step);
    const next = Math.max(0, Math.min(FLOWERS[type].max, state.counts[type] + d));
    if (d > 0 && totalStems() >= MAX_STEMS) return;
    state.counts[type] = next;
  }
  if (colour) {
    state.colors[type] = colour.dataset.color;
    // Farbe gewählt, aber noch keine Stiele: gleich ein paar dazulegen
    if (!state.counts[type]) state.counts[type] = Math.min(3, MAX_STEMS - totalStems());
  }
  render();
});

// Optionsgruppen einmal aufbauen; danach wird nur der Zustand umgeschaltet (Fokus bleibt erhalten)
const groups = [];
function options(el, entries, get, set, withPrice = false) {
  el.innerHTML = Object.entries(entries).map(([key, o]) => `
    <button type="button" role="radio" aria-checked="false" data-key="${key}">
      ${o.sw ? `<i style="--sw:${o.sw}"></i>` : ''}${o.short || o.label}${withPrice && o.price ? ` <small>+ ${euro.format(o.price)}</small>` : ''}
    </button>`).join('');
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-key]');
    if (!b) return;
    set(b.dataset.key);
    render();
  });
  groups.push(() => $$('[data-key]', el).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.key === get()))));
}
options($('#cfg-paper'), PAPERS, () => state.paper, (k) => { state.paper = k; }, true);
options($('#cfg-ribbon'), RIBBONS, () => state.ribbon, (k) => { state.ribbon = k; });
options($('#cfg-delivery'), DELIVERY, () => state.delivery, (k) => { state.delivery = k; }, true);

$('#cfg-card').addEventListener('change', (e) => { state.card = e.target.checked; render(); });

/* ---------- Strauß-Ansichten ---------- */
const stageWrap = $('#cfg-stage-wrap');
stageWrap.dataset.mode = 'flat';
const flat = createFlatBouquet($('#cfg-flat'), { reducedMotion });
let bouquet3d = null;
let stage3d = null;

function pushBouquet() {
  const comp = { stems: stemsOf(), paperStyle: state.paper, ribbonColor: state.ribbon };
  flat.set(comp);
  if (bouquet3d) {
    const { cap } = bouquet3d.set(comp);
    stage3d.setFrame({ x: 0, y: 0.2, z: 0 }, 1.05 + cap * 0.34);
    stage3d.kick();
  }
}

async function load3D() {
  if (stage3d) return;
  $('#cfg-load3d').hidden = true;
  try {
    const [{ createStage }, { createBouquet }, { loadRealFlowers }] = await Promise.all([
      import('../../assets/js/3d/stage.js'),
      import('../../assets/js/3d/bouquet.js'),
      import('../../assets/js/3d/real-flowers.js'),
    ]);
    // echte Blumen (Fotoscans, Fotos); falls das nicht klappt, bleiben die gezeichneten Blüten
    const real = await loadRealFlowers().catch((e) => { console.warn('Echte Blumen nicht geladen:', e); return null; });
    stage3d = createStage({ container: $('#cfg-stage'), reducedMotion, pitch: 0.3, spin: 0.16, shadows: true });
    bouquet3d = createBouquet({ reducedMotion, real });
    stage3d.pivot.add(bouquet3d.group);
    stage3d.onFrame((dt) => bouquet3d.update(dt));
    pushBouquet();
    await stage3d.whenRendered();
    stageWrap.dataset.mode = '3d';
    stage3d.canvas.addEventListener('pointerdown', () => $('#cfg-hint').remove(), { once: true });
  } catch (err) {
    console.warn('3D konnte nicht geladen werden:', err);
    $('#cfg-load3d').hidden = false;
  }
}

const cap = can3D();
if (cap.ok) {
  // 3D erst laden, wenn der Konfigurator in Sichtweite kommt
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load3D(); }
  }, { rootMargin: '700px 0px' });
  io.observe(stageWrap);
} else {
  $('#cfg-load3d').hidden = false;
  $('#cfg-load3d').title = cap.why;
  $('#cfg-load3d').addEventListener('click', load3D);
}

/* ---------- Preis ---------- */
let shownTotal = 0;
let tween = 0;
function showTotal(target) {
  cancelAnimationFrame(tween);
  const els = [$('#cfg-total'), bar && $('strong', bar)].filter(Boolean);
  if (reducedMotion) { shownTotal = target; els.forEach((el) => { el.textContent = euro.format(target); }); return; }
  const from = shownTotal, t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 450);
    shownTotal = from + (target - from) * (1 - Math.pow(1 - k, 3));
    els.forEach((el) => { el.textContent = euro.format(shownTotal); });
    if (k < 1) tween = requestAnimationFrame(step);
  };
  tween = requestAnimationFrame(step);
}

/* mobile Bestellleiste */
const bar = document.createElement('div');
bar.className = 'bk-bar';
bar.innerHTML = '<div><small>Ihr Strauß · <span>0</span> Stiele</small><strong>0,00 €</strong></div><button type="button" class="bk-btn">Reservieren</button>';
document.body.appendChild(bar);
bar.querySelector('button').addEventListener('click', () => openOrder());
let inConfig = false, summaryVisible = false;
const syncBar = () => bar.classList.toggle('is-visible', inConfig && !summaryVisible && totalStems() > 0);
new IntersectionObserver(([e]) => { inConfig = e.isIntersecting; syncBar(); }, { threshold: 0.05 }).observe($('#binden'));
new IntersectionObserver(([e]) => { summaryVisible = e.isIntersecting; syncBar(); }, { threshold: 0.3 }).observe($('#cfg-summary'));

/* ---------- Rendern ---------- */
function render() {
  const n = totalStems();
  for (const row of $$('.bk-flower', list)) {
    const type = row.dataset.type;
    const f = FLOWERS[type];
    const count = state.counts[type];
    row.classList.toggle('is-active', count > 0);
    $('output', row).textContent = count;
    $('[data-step="-1"]', row).disabled = count === 0;
    $('[data-step="1"]', row).disabled = count >= f.max || n >= MAX_STEMS;
    $$('[data-color]', row).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === state.colors[type])));
    $('.bk-flower__icon', row).innerHTML = icon(type, paletteOf(type));
  }
  groups.forEach((sync) => sync());
  $('#cfg-card').checked = state.card;

  const { lines, total } = price();
  $('#cfg-lines').innerHTML = lines.length
    ? lines.map(([l, v]) => `<li><span>${l}</span><span>${euro.format(v)}</span></li>`).join('')
    : '<li><span>Wählen Sie Ihre ersten Blumen.</span></li>';
  $('#cfg-count').textContent = n;
  $('span', bar).textContent = n;
  $('#cfg-order').disabled = n === 0;
  showTotal(total);
  syncBar();
  pushBouquet();
}

/* ---------- Reservierung (Demo) ---------- */
const dlg = $('#order');
const orderForm = $('#order-form');
function openOrder() {
  if (!totalStems()) return;
  const { lines, total } = price();
  $('#order-lines').innerHTML = lines.map(([l, v]) => `<li><span>${l}</span><span>${euro.format(v)}</span></li>`).join('');
  $('#order-total').textContent = euro.format(total);
  $('#order-status').textContent = 'Beispiel-Formular: Es wird nichts gesendet.';
  $('#order-status').classList.remove('is-ok');
  $('#order-submit').hidden = false;
  const d = new Date();
  orderForm.tag.min = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  dlg.showModal();
  document.documentElement.classList.add('is-locked');
}
$('#cfg-order').addEventListener('click', openOrder);
$('#order-cancel').addEventListener('click', () => dlg.close());
dlg.addEventListener('close', () => document.documentElement.classList.remove('is-locked'));
orderForm.addEventListener('submit', (e) => {
  e.preventDefault();
  let ok = true;
  ['name', 'tag'].forEach((n) => {
    const f = orderForm[n];
    const valid = f.value.trim() !== '';
    f.closest('.bk-field').classList.toggle('is-invalid', !valid);
    if (!valid) ok = false;
  });
  if (!ok) return;
  const [y, m, d] = orderForm.tag.value.split('-').map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#order-status').textContent = `Danke, ${orderForm.name.value.trim()}! Ihr Strauß läge am ${day} für Sie bereit. (Beispiel: Es wurde nichts gesendet.)`;
  $('#order-status').classList.add('is-ok');
  $('#order-submit').hidden = true;
  $('#order-cancel').textContent = 'Schließen';
});

render();

/* ---------- Scroll-Animationen ---------- */
function initMotion() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reducedMotion) {
    document.documentElement.classList.remove('js-motion');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });
  gsap.fromTo('[data-hero]', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.1, delay: 0.15 });
  gsap.fromTo('.bk-hero__media img', { scale: 1.12 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.bk-hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.09, overwrite: true }),
  });
}
initMotion();
