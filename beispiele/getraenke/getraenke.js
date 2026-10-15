import { afterInteraction, can3D, reducedMotion } from '../../assets/js/capability.js';
import { FLAVORS } from '../../assets/js/3d/funkl-data.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const IMG = '../../assets/img/funkl/';
const euro = (n) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const body = document.body;
const cap = can3D();
const { gsap, ScrollTrigger } = window;
const motion = !!gsap && !reducedMotion;

/* ---------- Produkte ---------- */
const PRODUCTS = [
  ...FLAVORS.map((f) => ({
    id: `dose-${f.id}`, name: `FUNKL ${f.name}`, meta: '1 Dose · 250 ml · Einweg', price: 2.49, cans: 1,
    img: [`${IMG}dose-${f.id}.webp`], p: [f.palette[0], f.palette[2]],
  })),
  { id: 'mix-12', name: 'Mix-Box', meta: '12 × 250 ml · je 4 von jeder Sorte', price: 26.9, cans: 12, box: true, badge: 'Für Einsteiger', img: FLAVORS.map((f) => `${IMG}dose-${f.id}.webp`), p: ['#ffd23f', '#ff2f7d'] },
  { id: 'box-24', name: 'Vorrats-Box', meta: '24 × 250 ml · alle drei Sorten gemischt', price: 49.9, cans: 24, box: true, badge: 'Versandfrei', img: FLAVORS.map((f) => `${IMG}dose-${f.id}.webp`).reverse(), p: ['#00d4ff', '#9b3cff'] },
];
const byId = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));
const perLiter = (p) => `${euro(p.price / (p.cans * 0.25))}/l`;
const WARN = 'Erhöhter Koffeingehalt (32 mg/100 ml). Für Kinder und schwangere oder stillende Frauen nicht empfohlen. Mit Süßungsmittel.';
const SHIPPING = 4.9, FREE_FROM = 24;

$('#products').innerHTML = PRODUCTS.map((p) => `
  <li class="fk-product${p.box ? ' fk-product--box' : ''}" style="--p1:${p.p[0]};--p2:${p.p[1]}">
    <div class="fk-product__media">
      ${p.badge ? `<span class="fk-product__badge">${p.badge}</span>` : ''}
      ${p.img.length > 1 ? `<div class="fk-trio">${p.img.map((src) => `<img src="${src}" width="600" height="800" alt="" loading="lazy">`).join('')}</div>`
        : `<img src="${p.img[0]}" width="600" height="800" alt="${p.name}, beschlagene Dose" loading="lazy">`}
    </div>
    <div class="fk-product__body">
      <h3 class="fk-product__name">${p.name}</h3>
      <p class="fk-product__meta">${p.meta}</p>
      <div class="fk-product__foot">
        <p class="fk-product__price">${euro(p.price)}<small>${perLiter(p)} · zzgl. ${euro(0.25 * p.cans)} Pfand (Einweg)</small></p>
        <button type="button" class="fk-add" data-add="${p.id}">In den Korb</button>
      </div>
      <p class="fk-product__warn">${WARN}</p>
    </div>
  </li>`).join('');

/* ---------- Sorten-Abschnitte ---------- */
$('#panels').innerHTML = FLAVORS.map((f, i) => `
  <article class="fk-panel" data-panel="${i}" aria-labelledby="panel-${f.id}">
    <div class="fk-panel__card">
      <p class="fk-panel__num">0${i + 1} / 03</p>
      <h3 class="fk-panel__name" id="panel-${f.id}">${f.name.replace(' ', '<br>')}</h3>
      <p class="fk-panel__tag">${f.tag}</p>
      <p class="fk-panel__text">${f.text}</p>
      <ul class="fk-chips"><li>Zero Zucker</li><li>80 mg Koffein</li><li>Vegan</li><li>3 kcal</li></ul>
      <div class="fk-panel__buy">
        <p class="fk-panel__price">${euro(2.49)}<small>9,96 €/l · + 0,25 € Pfand (Einweg)</small></p>
        <button type="button" class="fk-btn fk-btn--light" data-add="dose-${f.id}">In den Korb</button>
      </div>
      <p class="fk-panel__warn">${WARN}</p>
    </div>
  </article>`).join('');

/* ---------- Warenkorb ---------- */
let cart = {};
try { cart = JSON.parse(localStorage.getItem('funkl-cart') || '{}') || {}; } catch { cart = {}; }
const save = () => { try { localStorage.setItem('funkl-cart', JSON.stringify(cart)); } catch { /* privater Modus */ } };
const drawer = $('#drawer');

function renderCart() {
  const ids = Object.keys(cart).filter((id) => byId[id] && cart[id] > 0);
  const count = ids.reduce((n, id) => n + cart[id], 0);
  const cans = ids.reduce((n, id) => n + cart[id] * byId[id].cans, 0);
  const sum = ids.reduce((n, id) => n + cart[id] * byId[id].price, 0);
  $('#cart-count').textContent = count;
  $('#cart-open').setAttribute('aria-label', `Warenkorb öffnen, ${count} Artikel`);
  $('#cart-items').innerHTML = ids.map((id) => {
    const p = byId[id];
    return `<li style="--p1:${p.p[0]}"><img src="${p.img[0]}" alt=""><div><strong>${p.name}</strong><small>${p.meta}</small><small class="fk-line-price">${euro(p.price)} · ${perLiter(p)}</small></div>
      <div class="fk-qty"><button type="button" data-dec="${id}" aria-label="Eins weniger">−</button><span>${cart[id]}</span><button type="button" data-inc="${id}" aria-label="Eins mehr">+</button></div></li>`;
  }).join('');
  $('#cart-empty').hidden = ids.length > 0;
  const ship = cans === 0 || cans >= FREE_FROM ? 0 : SHIPPING;
  $('#cart-sum').textContent = euro(sum);
  $('#cart-deposit').textContent = euro(cans * 0.25);
  $('#cart-ship').textContent = ship ? euro(ship) : 'gratis';
  $('#cart-total').textContent = euro(sum + cans * 0.25 + ship);
  const left = Math.max(0, FREE_FROM - cans);
  $('#cart-progress').hidden = cans === 0;
  $('#cart-progress span').textContent = left ? `Noch ${left} ${left === 1 ? 'Dose' : 'Dosen'} bis versandkostenfrei` : 'Versandkostenfrei! ✦';
  $('#cart-progress i').style.width = `${Math.min(100, cans / FREE_FROM * 100)}%`;
  save();
}
renderCart();

function openCart(open) {
  drawer.hidden = !open;
  document.documentElement.classList.toggle('is-locked', open);
  if (open) $('#cart-close').focus(); else $('#cart-open').focus();
}
$('#cart-open').addEventListener('click', () => openCart(true));
$('#cart-close').addEventListener('click', () => openCart(false));
drawer.addEventListener('click', (e) => { if (e.target === drawer) openCart(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) openCart(false); });
$('#cart-items').addEventListener('click', (e) => {
  const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]');
  if (inc) cart[inc.dataset.inc]++;
  if (dec) cart[dec.dataset.dec] = Math.max(0, cart[dec.dataset.dec] - 1);
  if (inc || dec) renderCart();
});
$('#checkout').addEventListener('click', () => {
  $('#checkout-note').textContent = 'Beispiel-Shop: Hier ginge es jetzt zur Kasse (z. B. mit Shopify oder WooCommerce). Es wird nichts verkauft.';
});

// In den Korb: die Dose fliegt zum Korb-Symbol
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-add]');
  if (!b) return;
  const id = b.dataset.add;
  cart[id] = (cart[id] || 0) + 1;
  renderCart();
  const label = b.textContent;
  b.classList.add('is-added');
  b.textContent = 'Drin! ✦';
  setTimeout(() => { b.classList.remove('is-added'); b.textContent = label; }, 1300);
  if (!motion) return;
  const target = $('#cart-open').getBoundingClientRect();
  const src = b.closest('.fk-product')?.querySelector('.fk-product__media img') || null;
  const from = (src || b).getBoundingClientRect();
  const img = document.createElement('img');
  img.src = byId[id].img[0];
  img.className = 'fk-fly';
  img.alt = '';
  document.body.append(img);
  const x0 = from.left + from.width / 2 - 35, y0 = from.top + from.height / 2 - 45;
  const x1 = target.left + target.width / 2 - 35, y1 = target.top + target.height / 2 - 45;
  gsap.set(img, { x: x0, y: y0, scale: src ? 1.4 : 0.8, rotation: 0 });
  const tl = gsap.timeline({ onComplete: () => img.remove() });
  tl.to(img, { x: x1, duration: 0.9, ease: 'power1.inOut' }, 0)
    .to(img, { y: Math.min(y0, y1) - 140, duration: 0.42, ease: 'power2.out' }, 0)
    .to(img, { y: y1, duration: 0.48, ease: 'power2.in' }, 0.42)
    .to(img, { rotation: 540, scale: 0.25, duration: 0.9, ease: 'power1.in' }, 0)
    .to(img, { opacity: 0, duration: 0.12 }, 0.82)
    .fromTo('#cart-open', { scale: 1 }, { scale: 1.25, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out' }, 0.86)
    .fromTo('#cart-count', { scale: 0.4 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1.2, 0.4)' }, 0.9);
});

/* ---------- Laufband: Inhalt doppeln für nahtlose Schleife ---------- */
const ticker = $('#ticker');
ticker.innerHTML += ticker.innerHTML;

/* ---------- Sorte der Seite (Farben) ---------- */
function setPageFlavor(i) { body.dataset.flavor = FLAVORS[i].id; }

/* ---------- Intro ---------- */
const heroEl = $('#top');
let hero = null;
let heroInView = true;
new IntersectionObserver(([e]) => { heroInView = e.isIntersecting; }, { threshold: 0.3 }).observe(heroEl);

function onHeroFlavor(i) {
  const f = FLAVORS[i];
  if (heroInView) setPageFlavor(i);
  const name = $('#hero-flavor'), tag = $('#hero-tag');
  if (!motion) { name.textContent = f.name; tag.textContent = f.tag; return; }
  gsap.timeline()
    .to([name, tag], { yPercent: -60, opacity: 0, duration: 0.25, ease: 'power2.in', stagger: 0.04 })
    .add(() => { name.textContent = f.name; tag.textContent = f.tag; })
    .fromTo([name, tag], { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'back.out(2)', stagger: 0.05 });
}

// Logo aus Einzelteilen: Striche fliegen von überall herein und rasten ein
const shadowG = $('.fk-logo__shadow');
$$('.fk-logo__main > *').forEach((el) => shadowG.append(el.cloneNode()));
function logoTimeline() {
  const pieces = $$('.fk-logo__main .fk-piece');
  const shadow = $$('.fk-logo__shadow > *');
  const spark = $('.fk-logo__main .fk-spark');
  const colors = ['#ffd23f', '#ff2f7d', '#00d4ff', '#a8ff3e', '#9b3cff', '#ff6a00'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const tl = gsap.timeline();
  tl.set(shadow, { opacity: 0 })
    .set('#hero-title', { y: () => heroEl.clientHeight * 0.36, scale: 1.25 })
    .fromTo(pieces, {
      x: () => rnd(-420, 420), y: () => rnd(-320, 320), rotation: () => rnd(-240, 240), scale: 0,
      stroke: () => colors[Math.floor(Math.random() * colors.length)], transformOrigin: '50% 50%',
    }, { x: 0, y: 0, rotation: 0, scale: 1, duration: 1.0, ease: 'back.out(1.6)', stagger: { each: 0.045, from: 'random' } }, 0.55)
    .fromTo(spark, { scale: 0, rotation: -360, transformOrigin: '50% 50%' }, { scale: 1, rotation: 0, duration: 0.9, ease: 'back.out(3)' }, 1.35)
    .to(pieces, { stroke: '#ffffff', duration: 0.12, stagger: 0.015, ease: 'none' }, 1.55)
    .to(shadow, { opacity: 1, duration: 0.35, stagger: 0.02 }, 1.7)
    .fromTo(shadowG, { x: -9, y: -11 }, { x: 0, y: 0, duration: 0.6, ease: 'back.out(2)' }, 1.7)
    .to('#hero-title', { y: 0, scale: 1, duration: 1.1, ease: 'expo.inOut' }, 1.85)
    .fromTo(pieces, { y: 0 }, { y: -10, duration: 0.22, yoyo: true, repeat: 1, ease: 'power2.out', stagger: 0.03 }, 2.9)
    .fromTo('.fk-hero__flavor', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.7, ease: 'back.out(2)' }, 2.8)
    .fromTo('[data-intro]', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.1, ease: 'power3.out' }, 3.0);
  // Funke funkelt weiter
  gsap.to(spark, { rotation: 90, scale: 1.18, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 3.2, transformOrigin: '50% 50%' });
  return tl;
}

async function startHero() {
  try {
    const { createHero } = await import('../../assets/js/3d/funkl-hero.js');
    const { loadFonts } = await import('../../assets/js/3d/can.js');
    await loadFonts('../../assets/fonts/');
    hero = await createHero({ container: $('#hero-canvas'), reducedMotion: !motion, gsap: motion ? gsap : null, onFlavor: onHeroFlavor });
    heroEl.classList.add('is-live');
    hero.play();
    if (motion) logoTimeline();
  } catch (err) {
    console.warn('3D-Intro nicht verfügbar:', err);
    if (motion) logoTimeline();
  }
}

$('#motion-toggle').addEventListener('click', (e) => {
  const b = e.currentTarget;
  const pause = b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', String(pause));
  b.setAttribute('aria-label', pause ? 'Animation fortsetzen' : 'Animation anhalten');
  if (pause) { gsap?.globalTimeline.pause(); hero?.pause?.(); } else { gsap?.globalTimeline.resume(); hero?.resume?.(); }
});

/* ---------- Sorten in 3D ---------- */
let showcase = null;
async function startShowcase() {
  try {
    const { createShowcase } = await import('../../assets/js/3d/funkl-showcase.js');
    const { loadFonts } = await import('../../assets/js/3d/can.js');
    await loadFonts('../../assets/fonts/');
    showcase = await createShowcase({ container: $('#stage-canvas'), reducedMotion: !motion });
    $('#sorten').classList.add('is-live');
    showcase.setFlavor(currentPanel);
    showcase.onInteract(() => $('#wipe-hint').classList.add('is-done'));
  } catch (err) {
    console.warn('3D-Sorten nicht verfügbar:', err);
  }
}

let currentPanel = 0;
function choosePanel(i) {
  currentPanel = i;
  setPageFlavor(i);
  showcase?.setFlavor(i);
  $('#stage-poster').src = `${IMG}dose-${FLAVORS[i].id}.webp`;
}

// Panels: welche Sorte ist gerade in der Mitte des Bildschirms?
const panelIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) choosePanel(+e.target.dataset.panel); });
}, { rootMargin: '-45% 0px -45% 0px' });
$$('[data-panel]').forEach((p) => panelIO.observe(p));

if (cap.ok) {
  startHero();
  const near = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; near.disconnect(); startShowcase(); }, { rootMargin: '100% 0px' });
  afterInteraction(() => near.observe($('#sorten'))); // erst, wenn jemand die Seite bedient
} else {
  $('#wipe-hint').hidden = true;
  if (motion) logoTimeline();
}

/* ---------- Scroll-Animationen ---------- */
if (motion && ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  // Dose dreht sich mit dem Scrollen durch die Sorten
  ScrollTrigger.create({
    trigger: '#sorten', start: 'top 60%', end: 'bottom bottom',
    onUpdate: (st) => showcase?.setRotation(Math.sin(st.progress * Math.PI * 3) * 0.55), // pendelt, Vorderseite bleibt sichtbar
  });
  // Sortennamen: Buchstaben springen herein
  $$('.fk-panel__name').forEach((h) => {
    // Buchstaben einzeln animieren, Wörter aber zusammenhalten (kein Umbruch mitten im Wort)
    h.innerHTML = h.innerHTML.split('<br>').map((line) => line.split(' ').map((word) => `<span style="display:inline-block;white-space:nowrap">${word.split('').map((ch) => `<span class="ch" style="display:inline-block">${ch}</span>`).join('')}</span>`).join(' ')).join('<br>');
    gsap.from(h.querySelectorAll('.ch'), {
      yPercent: 110, rotation: () => (Math.random() - 0.5) * 30, opacity: 0, duration: 0.7, ease: 'back.out(2)', stagger: 0.025,
      scrollTrigger: { trigger: h, start: 'top 85%' },
    });
  });
  // Produkte ploppen auf
  ScrollTrigger.batch('.fk-product', {
    start: 'top 90%', once: true,
    onEnter: (els) => gsap.from(els, { y: 80, rotation: () => (Math.random() - 0.5) * 8, opacity: 0, duration: 0.9, ease: 'back.out(1.6)', stagger: 0.08 }),
  });
  gsap.from('.fk-cold > *', { y: 40, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: '.fk-cold', start: 'top 80%' } });
  // Laufband kippt beim Scrollen leicht
  gsap.to('.fk-ticker', { rotation: 1.4, ease: 'none', scrollTrigger: { trigger: '.fk-ticker', start: 'top bottom', end: 'bottom top', scrub: true } });
} else {
  $$('[data-intro], .fk-hero__flavor').forEach((el) => { el.style.opacity = 1; });
}
