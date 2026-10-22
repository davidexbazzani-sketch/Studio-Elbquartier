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
    hero = await createHero({ container: $('#hero-canvas'), reducedMotion: !motion, gsap: motion ? gsap : null, onFlavor: onHeroFlavor,
      onLost: () => heroEl.classList.remove('is-live') });
    // Antippen oder Klicken ins Intro: Spritzer und ein Hüpfer der Dose (nicht auf Knöpfen)
    heroEl.addEventListener('click', (e) => { if (!e.target.closest('a, button')) hero.poke?.(); });
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
    showcase = await createShowcase({ container: $('#stage-canvas'), reducedMotion: !motion, onLost: () => $('#sorten').classList.remove('is-live') });
    $('#sorten').classList.add('is-live');
    showcase.setFlavor(currentPanel);
    showcase.onInteract(() => $('#wipe-hint').classList.add('is-done'));
  } catch (err) {
    console.warn('3D-Sorten nicht verfügbar:', err);
  }
}

/* ---------- Kohlensäure-Perlen und Kondenstropfen ----------
   Web Animations mit festen Zahlen: Das rechnet die Grafikkarte allein, der Hauptfaden bleibt frei. */
const rnd = (a, b) => a + Math.random() * (b - a);
const fx = { sorten: [], cold: [] };
if (!reducedMotion && Element.prototype.animate) {
  const stageBox = $('#stage-bubbles');
  stageBox.innerHTML = '<span></span>'.repeat(14);
  const rise = () => stageBox.clientHeight + 60;
  $$('span', stageBox).forEach((el) => {
    const s = rnd(6, 22), w = rnd(-26, 26), h = rise();
    Object.assign(el.style, { left: `${rnd(4, 92).toFixed(1)}%`, width: `${s}px`, height: `${s}px` });
    const a = el.animate([
      { transform: 'translate3d(0,0,0) scale(0.6)', opacity: 0 },
      { transform: `translate3d(${w * 0.4}px,${-h * 0.12}px,0) scale(0.7)`, opacity: 0.9, offset: 0.12 },
      { transform: `translate3d(${w}px,${-h * 0.5}px,0) scale(0.85)`, opacity: 0.85, offset: 0.5 },
      { transform: `translate3d(${-w * 0.3}px,${-h * 0.88}px,0) scale(0.95)`, opacity: 0.8, offset: 0.88 },
      { transform: `translate3d(0,${-h}px,0) scale(1)`, opacity: 0 },
    ], { duration: rnd(5000, 10000), iterations: Infinity, easing: 'linear', delay: -rnd(0, 10000) });
    a.pause();
    fx.sorten.push(a);
  });
  const coldBox = $('#cold-drops');
  coldBox.innerHTML = '<span></span>'.repeat(8);
  $$('span', coldBox).forEach((el, i) => {
    const s = rnd(12, 28), h = rnd(220, 480);
    Object.assign(el.style, { left: `${(i < 4 ? rnd(2, 20) : rnd(80, 96)).toFixed(1)}%`, width: `${s}px`, height: `${s * 1.25}px` });
    // läuft stockend: hängen, rutschen, hängen, rutschen
    const a = el.animate([
      { transform: 'translate3d(0,0,0) scale(0.7)', opacity: 0 },
      { transform: 'translate3d(0,40px,0) scale(1)', opacity: 1, offset: 0.08 },
      { transform: 'translate3d(0,40px,0) scale(1)', opacity: 1, offset: 0.3, easing: 'cubic-bezier(0.5,0,0.6,1)' },
      { transform: `translate3d(2px,${h * 0.45}px,0) scale(1,1.08)`, opacity: 1, offset: 0.48 },
      { transform: `translate3d(2px,${h * 0.45}px,0) scale(1,1)`, opacity: 1, offset: 0.64, easing: 'cubic-bezier(0.5,0,0.6,1)' },
      { transform: `translate3d(-1px,${h}px,0) scale(1,1.12)`, opacity: 1, offset: 0.92 },
      { transform: `translate3d(-1px,${h * 1.1}px,0) scale(1,1)`, opacity: 0 },
    ], { duration: rnd(7000, 13000), iterations: Infinity, delay: -rnd(0, 12000) });
    a.pause();
    fx.cold.push(a);
  });
  // nur laufen, wenn der Abschnitt in der Nähe ist
  const nearIO = new IntersectionObserver((list) => list.forEach((e) => {
    fx[e.target.id === 'sorten' ? 'sorten' : 'cold'].forEach((a) => (e.isIntersecting ? a.play() : a.pause()));
  }), { rootMargin: '100px 0px' });
  ['#sorten', '.fk-cold'].forEach((s) => nearIO.observe($(s)));
}

const bgs = $$('.fk-flavors__bgs i');
let currentPanel = 0;
function choosePanel(i) {
  currentPanel = i;
  setPageFlavor(i);
  bgs.forEach((b, k) => b.classList.toggle('is-on', k === i));
  showcase?.setFlavor(i);
  $('#stage-poster').src = `${IMG}dose-${FLAVORS[i].id}.webp`;
}

// Panels: welche Sorte ist gerade in der Mitte des Bildschirms?
const panelIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) choosePanel(+e.target.dataset.panel); });
}, { rootMargin: '-45% 0px -45% 0px' });
$$('[data-panel]').forEach((p) => panelIO.observe(p));

if (cap.ok) {
  // 3D-Dose erst nach dem Seitenaufbau starten: Das Dosenfoto ist sofort da, die Seite sofort bedienbar
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') idle(startHero); else addEventListener('load', () => idle(startHero), { once: true });
  // Aufbau der Dose (Früchte laden, Shader) kostet einen Moment: erst starten, wenn das Scrollen kurz ruht, sonst hakt das Wischen
  const whenScrollRests = (fn, ms = 220) => {
    let t = 0;
    const done = () => { removeEventListener('scroll', on); fn(); };
    const on = () => { clearTimeout(t); t = setTimeout(done, ms); };
    addEventListener('scroll', on, { passive: true });
    on();
  };
  const near = new IntersectionObserver(([e]) => { if (!e.isIntersecting) return; near.disconnect(); whenScrollRests(startShowcase); }, { rootMargin: '100% 0px' });
  afterInteraction(() => near.observe($('#sorten')), { fallback: Infinity, events: ['scroll', 'wheel', 'keydown', 'touchmove'] }); // erst beim Scrollen
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
  const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
  const euroText = (n) => n.toFixed(2).replace('.', ',') + ' €';

  // Sorten-Karten: rollen von unten herein, Etikett schnappt ein, Preis zählt hoch, Knopf ploppt
  $$('.fk-panel').forEach((panel) => {
    const card = $('.fk-panel__card', panel);
    const price = $('.fk-panel__price', panel);
    const priceNode = price.firstChild; // „2,49 €“ vor dem <small>
    const tl = gsap.timeline({ scrollTrigger: { trigger: panel, start: 'top 75%', once: true } });
    tl.from(card, { y: 90, rotation: -3, scale: 0.94, opacity: 0, duration: 0.95, ease: 'back.out(1.3)', clearProps: 'transform,opacity' })
      .from($('.fk-panel__tag', panel), { scale: 0, rotation: -24, duration: 0.6, ease: 'back.out(3)', clearProps: 'transform' }, 0.35)
      .from($$('.fk-chips li', panel), { y: 14, opacity: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out', clearProps: 'all' }, 0.45)
      .from($('[data-add]', panel), { scale: 0.6, opacity: 0, duration: 0.7, ease: 'elastic.out(1.1, 0.5)', clearProps: 'transform,opacity' }, 0.55);
    if (priceNode?.nodeType === 3) {
      const o = { v: 0 };
      tl.to(o, { v: 2.49, duration: 0.8, ease: 'power2.out', onUpdate: () => { priceNode.textContent = euroText(o.v); } }, 0.4);
    }
  });

  // Angeber-Band: Wörter fallen einzeln herein
  const cold = $('#cold-title');
  // Wörter einzeln; der farbige Teil (em mit Verlauf) bleibt ein Stück, sonst bricht der Farbverlauf
  cold.innerHTML = cold.innerHTML.replace(/^([^<]*)/, (m) => m.trim().split(' ').map((w) => `<span class="w">${w}</span>`).join(' ') + ' ')
    .replace(/<em>[\s\S]*?<\/em>/, (m) => `<span class="w">${m}</span>`);
  $$('.w', cold).forEach((w) => { w.style.display = 'inline-block'; });
  gsap.timeline({ scrollTrigger: { trigger: '.fk-cold', start: 'top 78%', once: true } })
    .from('.fk-cold .fk-eyebrow', { y: 20, opacity: 0, duration: 0.6, ease: 'power3.out' })
    .from($$('.w', cold), { yPercent: 120, rotation: () => rnd(-14, 14), opacity: 0, duration: 0.8, stagger: 0.07, ease: 'back.out(1.8)' }, 0.1)
    .from('.fk-cold .fk-lead', { y: 30, opacity: 0, duration: 0.8, ease: 'power3.out' }, 0.45);

  // Shop: Karten klappen nach vorn, Dosen ploppen hinein, Abzeichen schwingen ein
  ScrollTrigger.batch('.fk-product', {
    start: 'top 92%', once: true,
    onEnter: (els) => els.forEach((el, k) => {
      const imgs = $$('.fk-product__media img', el);
      gsap.timeline({ delay: k * 0.1 })
        .from(el, { y: 70, rotationX: -22, transformPerspective: 900, transformOrigin: '50% 100%', opacity: 0, duration: 0.9, ease: 'power3.out', clearProps: 'transform,opacity' })
        .from(imgs, { y: 50, scale: 0.55, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'back.out(2.2)', clearProps: 'transform,opacity' }, 0.15)
        .from($('.fk-product__badge', el), { scale: 0, rotation: -60, duration: 0.6, ease: 'back.out(3)', clearProps: 'transform' }, 0.45);
    }),
  });

  // Nährwerte: Zeilen gleiten herein, Zahlen zählen hoch
  const rows = $$('.fk-table tr');
  gsap.timeline({ scrollTrigger: { trigger: '.fk-table', start: 'top 82%', once: true } })
    .from(rows, { x: -24, opacity: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out', clearProps: 'all' });
  rows.forEach((tr, k) => {
    const td = $('td', tr);
    const txt = td.textContent;
    const m = txt.match(/^(\d+(?:,\d+)?)/);
    if (!m || m[1] === '0') return;
    const target = parseFloat(m[1].replace(',', '.')), dec = (m[1].split(',')[1] || '').length;
    const rest = txt.slice(m[1].length), o = { v: 0 };
    gsap.to(o, { v: target, duration: 1.1, delay: 0.1 + k * 0.06, ease: 'power2.out',
      scrollTrigger: { trigger: '.fk-table', start: 'top 82%', once: true },
      onUpdate: () => { td.textContent = o.v.toFixed(dec).replace('.', ',') + rest; } });
  });

  // Laufband kippt beim Scrollen leicht (nur mit Maus: auf Handys hinken an den Scrollweg gekoppelte Bewegungen hinterher)
  if (!touch) gsap.to('.fk-ticker', { rotation: 1.4, ease: 'none', scrollTrigger: { trigger: '.fk-ticker', start: 'top bottom', end: 'bottom top', scrub: true } });
} else {
  $$('[data-intro], .fk-hero__flavor').forEach((el) => { el.style.opacity = 1; });
}
