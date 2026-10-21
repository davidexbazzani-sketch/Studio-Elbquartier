/* Themenseiten: nur Navigation und Jahreszahl – kein 3D, keine Animationsbibliothek, damit die Seiten sofort da sind. */
const nav = document.getElementById('nav');
const toggle = nav?.querySelector('.nav__toggle');
const onScroll = () => nav?.classList.toggle('is-scrolled', window.scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();
toggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
});
nav?.querySelectorAll('.nav__sheet a').forEach((a) => a.addEventListener('click', () => {
  nav.classList.remove('is-open');
  toggle?.setAttribute('aria-expanded', 'false');
}));
const year = document.getElementById('year');
if (year) year.textContent = new Date().getFullYear();
