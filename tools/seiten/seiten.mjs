// Themenseiten (Webdesign, Fotografie, Software) für Suchmaschinen erzeugen.
// Pakete, Ablauf, Software-Liste und Umstieg werden aus index.html übernommen, damit Preise und Texte immer übereinstimmen.
//   node tools/seiten/seiten.mjs        (im Ordner Website ausführen, danach committen)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const BASE = 'https://studio-elbquartier.de';
const index = readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');

// Block mit ausgeglichenen Tags ab dem Start-Tag herauslösen
function block(startTag, tag) {
  const start = index.indexOf(startTag);
  if (start < 0) throw new Error('Block fehlt: ' + startTag);
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'g');
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(index))) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return index.slice(start, m.index + m[0].length);
  }
  throw new Error('Ende fehlt: ' + startTag);
}
// Für Unterseiten: Einblend-Attribute raus, Paket-Buttons auf die Startseite mit Vorauswahl
const fit = (html) => html
  .replace(/ data-reveal/g, '')
  .replace(/href="#kontakt" data-plan="([^"]+)"/g, 'href="/?interesse=$1#kontakt"')
  .replace(/href="#kontakt"/g, 'href="/#kontakt"')
  .replace(/href="#(pakete|software|ablauf|team|beispiele)"/g, 'href="/#$1"');

const plans = fit(block('<div class="plans"', 'div'));
const plansNote = fit(index.match(/<p class="plans__note"[^>]*>[\s\S]*?<\/p>/)[0]);
const steps = fit(block('<ol class="steps__list">', 'ol'));
const umstieg = fit(block('<div class="umstieg__grid">', 'div')).replace(/<(\/?)h4\b/g, '<$1h3'); // auf Themenseiten folgt die Karte direkt auf eine H2
const software = fit(block('<div class="sw-grid"', 'div'));

const LOGO = `<svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
          <circle cx="16" cy="16" r="15" fill="none" stroke="currentColor" stroke-width="1.2"/>
          <path d="M6 17.5c3.3-2.6 6.7-2.6 10 0s6.7 2.6 10 0" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M8 21.5c2.7-2 5.3-2 8 0s5.3 2 8 0" fill="none" stroke="#a88a5f" stroke-width="1.2" stroke-linecap="round"/>
        </svg>`;
const NAV = [['/#beispiele', 'Beispiele'], ['/webdesign-hamburg/', 'Webdesign'], ['/fotografie-hamburg/', 'Fotografie'], ['/software-hamburg/', 'Software'], ['/#pakete', 'Pakete'], ['/#kontakt', 'Kontakt']];
const nav = (slug) => NAV.map(([h, t]) => `<a href="${h}"${h === `/${slug}/` ? ' aria-current="page"' : ''}>${t}</a>`).join('\n        ');

const BEISPIELE = [
  ['blumenladen', 'blumen', 'Blütenkontor', 'Blumenladen'], ['restaurant', 'restaurant', 'Fährhaus Zwölf', 'Restaurant'],
  ['cafe', 'cafe', 'Kaffeehaus Möwe', 'Café'], ['bar', 'bar', 'Nachtfalter', 'Bar'],
  ['boutique', 'boutique', 'Linnen &amp; Lou', 'Boutique'], ['juwelier', 'juwelier', 'Holst &amp; Tochter', 'Juwelier'],
  ['brillen', 'brillen', 'Klarsund', 'Optiker'], ['autohaus', 'autohaus', 'Halden Automobile', 'Autohaus'],
  ['getraenke', 'getraenke', 'FUNKL', 'Getränke-Shop'], ['immobilien', 'immobilien', 'Solmund', 'Immobilien'],
];
const beispiele = (n = 10) => `<ul class="examples">
          ${BEISPIELE.slice(0, n).map(([dir, img, name, typ]) => `<li><a class="examples__item" href="/beispiele/${dir}/">
            <img src="/assets/img/hero/${img}.webp" width="640" height="400" alt="Startseite der Beispiel-Website ${name} (${typ})" loading="lazy" decoding="async">
            <span><strong>${name}</strong> ${typ}</span>
          </a></li>`).join('\n          ')}
        </ul>
        <p class="examples__note">Alle Namen sind erfunden, die Ideen sind echt.</p>`;

function seite({ slug, title, description, h1, h1b, lead, ctas, crumb, service, body }) {
  const url = `${BASE}/${slug}/`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Service', '@id': `${url}#service`, name: service.name, serviceType: service.type, description, url,
        areaServed: { '@type': 'City', name: 'Hamburg' }, provider: { '@id': `${BASE}/#studio` }, ...(service.offers ? { offers: service.offers } : {}) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Studio Elbquartier', item: `${BASE}/` },
        { '@type': 'ListItem', position: 2, name: crumb, item: url } ] },
    ],
  };
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#faf7f2">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="canonical" href="${url}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="de_DE">
  <meta property="og:site_name" content="Studio Elbquartier">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${BASE}/assets/img/og.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="geo.region" content="DE-HH">
  <meta name="geo.placename" content="Hamburg">
  <link rel="preload" href="/assets/fonts/fraunces-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/fonts/geist-latin-wght.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/css/design-system.css?v=20261022o">
  <link rel="stylesheet" href="/assets/css/home.css?v=20261022o">
  <link rel="stylesheet" href="/assets/css/seite.css">
  <script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
  </script>
</head>
<body>
  <a class="skip-link" href="#inhalt">Zum Inhalt springen</a>
  <!-- Erzeugt von tools/seiten/seiten.mjs – Änderungen dort vornehmen und neu erzeugen -->
  <header class="nav" id="nav">
    <div class="container nav__inner">
      <a class="nav__brand" href="/" aria-label="Studio Elbquartier – zur Startseite">
        ${LOGO}
        Studio Elbquartier
      </a>
      <nav class="nav__links" aria-label="Hauptnavigation">
        ${nav(slug)}
      </nav>
      <div class="nav__actions">
        <a class="btn btn--small" href="/#kontakt">Termin anfragen</a>
        <button class="nav__toggle" type="button" aria-expanded="false" aria-controls="nav-sheet" aria-label="Menü öffnen"><span></span></button>
      </div>
    </div>
    <nav class="nav__sheet" id="nav-sheet" aria-label="Mobile Navigation">
      ${nav(slug)}
    </nav>
  </header>

  <main id="inhalt">
    <section class="page-hero">
      <div class="container page-hero__inner">
        <nav class="crumbs" aria-label="Brotkrumen"><a href="/">Startseite</a><span aria-hidden="true">/</span><span aria-current="page">${crumb}</span></nav>
        <h1 class="t-h1 page-hero__title">${h1}<br><span class="t-serif-italic">${h1b}</span></h1>
        <p class="t-lead page-hero__lead">${lead}</p>
        <div class="page-hero__cta">${ctas}</div>
        <p class="page-hero__note"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>Persönlich vor Ort in Hamburg. Bezahlt wird erst, wenn Ihnen der Entwurf gefällt.</p>
      </div>
    </section>
${body}
    <section class="section">
      <div class="container">
        <div class="cta-band">
          <div class="cta-band__text">
            <h2 class="t-h3">Lassen Sie uns<br><span class="t-serif-italic">ins Gespräch kommen.</span></h2>
            <p class="t-small">Bei Ihnen vor Ort, bei einem Kaffee oder einfach am Telefon. Wir melden uns in der Regel innerhalb eines Werktags.</p>
          </div>
          <div class="cta-band__actions">
            <a class="btn" href="/#kontakt">Anfrage senden</a>
            <a class="btn btn--secondary" href="tel:+4917631685816">0176 31685816</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container footer__inner">
      <p>© <span id="year">2026</span> Studio Elbquartier · Hamburg · <a href="mailto:hallo@studio-elbquartier.de">hallo@studio-elbquartier.de</a></p>
      <nav aria-label="Leistungen und Rechtliches">
        <a href="/webdesign-hamburg/">Webdesign Hamburg</a>
        <a href="/fotografie-hamburg/">Fotografie</a>
        <a href="/software-hamburg/">Software</a>
        <a href="/impressum.html">Impressum</a>
        <a href="/datenschutz.html">Datenschutz</a>
        <a href="/lizenzen.html">Bildnachweise</a>
      </nav>
    </div>
  </footer>
  <script src="/assets/js/seite.js" defer></script>${body.includes('data-demo') ? '\n  <script src="/assets/js/software-demos.js" defer></script>' : ''}
</body>
</html>
`;
}

const PAKET_ANGEBOTE = [['Website Starter', 750], ['Website Pro', 1200], ['Website Max', 3000]]
  .map(([name, price]) => ({ '@type': 'Offer', name, price: String(price), priceCurrency: 'EUR' }));

const seiten = [
  {
    slug: 'webdesign-hamburg',
    title: 'Webdesign Hamburg: Websites für Läden &amp; Gastronomie | Studio Elbquartier',
    description: 'Website erstellen lassen in Hamburg: individuelles Webdesign für Läden, Restaurants, Cafés, Bars und Boutiquen. Pakete ab 750 € Endpreis, bezahlt wird erst, wenn Ihnen der Entwurf gefällt.',
    crumb: 'Webdesign Hamburg',
    h1: 'Webdesign in Hamburg', h1b: 'für Läden, Restaurants und Boutiquen.',
    lead: 'Wir erstellen Ihre Website so, dass sie zeigt, was Ihren Laden ausmacht: auf dem Handy wie am Computer schnell, klar und für Google vorbereitet. Bestehende Websites und Shopify-Shops machen wir neu.',
    ctas: '<a class="btn" href="#pakete">Pakete und Preise</a><a class="btn btn--secondary" href="#beispiele">Beispiele ansehen</a>',
    service: { name: 'Webdesign in Hamburg', type: 'Webdesign', offers: PAKET_ANGEBOTE },
    body: `
    <section class="section" id="beispiele" aria-labelledby="bsp-title">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow" style="--eyebrow-dot: var(--c-sand-deep)">Beispiele</p>
          <h2 class="t-h2" id="bsp-title">So könnte Ihre Website<br><span class="t-serif-italic">aussehen.</span></h2>
          <p class="t-lead">Zehn Beispiel-Websites für ganz unterschiedliche Läden. Jede ist zum Anschauen und Ausprobieren, auf dem Handy wie am Computer.</p>
        </header>
        ${beispiele()}
      </div>
    </section>

    <section class="section section--alt" id="pakete" aria-labelledby="pakete-title">
      <div class="container">
        <header class="section-head section-head--center">
          <p class="eyebrow" style="--eyebrow-dot: var(--c-rose-deep)">Pakete und Preise</p>
          <h2 class="t-h2" id="pakete-title">Ein fairer Preis. Ohne Abo.</h2>
          <p class="t-lead">Einmal bezahlen, Website behalten. Und zwar erst, wenn Ihnen der fertige Entwurf gefällt.</p>
        </header>
        ${plans}
        ${plansNote}
      </div>
    </section>

    <section class="section steps" id="ablauf" aria-labelledby="ablauf-title">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow" style="--eyebrow-dot: var(--c-sage-deep)">So arbeiten wir</p>
          <h2 class="t-h2" id="ablauf-title">Erst überzeugen.<br><span class="t-serif-italic">Dann bezahlen.</span></h2>
        </header>
        ${steps}
      </div>
    </section>

    <section class="section section--alt" aria-labelledby="umstieg-title">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow" style="--eyebrow-dot: var(--c-sage-deep)">Umstieg</p>
          <h2 class="t-h2" id="umstieg-title">Sie haben schon eine Website<br><span class="t-serif-italic">oder einen Shopify-Shop?</span></h2>
          <p class="t-lead">Kein Problem. Für Sie ändert sich nur, wie gut Ihr Auftritt aussieht und gefunden wird.</p>
        </header>
        ${umstieg}
      </div>
    </section>`,
  },
  {
    slug: 'fotografie-hamburg',
    title: 'Fotograf für Laden, Produkte &amp; Team in Hamburg | Studio Elbquartier',
    description: 'Professionelle Fotos für Ihren Laden in Hamburg: Räume, Produkte und Team für Website und Social Media. Oder wir holen das Beste aus den Bildern heraus, die Sie schon haben.',
    crumb: 'Fotografie Hamburg',
    h1: 'Fotografie in Hamburg', h1b: 'für Laden, Produkte und Team.',
    lead: 'Unser Fotograf setzt Ihre Räume, Ihre Produkte und Ihr Team professionell in Szene, für Ihre Website und Ihre Social-Media-Kanäle. Oder wir holen das Beste aus den Bildern heraus, die Sie schon haben.',
    ctas: '<a class="btn" href="/?interesse=Foto#kontakt">Fotoshooting anfragen</a><a class="btn btn--secondary" href="#paket-max">Im Paket Max enthalten</a>',
    service: { name: 'Fotografie für Laden, Produkte und Team in Hamburg', type: 'Fotografie' },
    body: `
    <section class="section" aria-labelledby="motive-title">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow" style="--eyebrow-dot: var(--c-sand-deep)">Was wir fotografieren</p>
          <h2 class="t-h2" id="motive-title">Bilder, die Lust machen,<br><span class="t-serif-italic">vorbeizukommen.</span></h2>
        </header>
        <ul class="software__list">
          <li class="card software__item"><span class="icon-tile icon-tile--sand"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span><h3 class="t-h3">Ihre Räume</h3><p class="t-small">Ihr Laden, wie Ihre Kundschaft ihn erlebt: Schaufenster, Theke, Atmosphäre.</p></li>
          <li class="card software__item"><span class="icon-tile icon-tile--rose"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a1.5 1.5 0 01-1.5 1.3H7.7a1.5 1.5 0 01-1.5-1.3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 10.5V7a3 3 0 016 0v3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span><h3 class="t-h3">Ihre Produkte</h3><p class="t-small">Für Website, Shop und Social Media, einheitlich und hochwertig.</p></li>
          <li class="card software__item"><span class="icon-tile icon-tile--elbe"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="16.5" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M3.5 19c.8-3 3-4.5 5.5-4.5s4.7 1.5 5.5 4.5M14 15.2c.8-.5 1.6-.7 2.5-.7 2 0 3.5 1.2 4 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span><h3 class="t-h3">Ihr Team</h3><p class="t-small">Die Menschen hinter Ihrem Laden, damit Ihre Kundschaft weiß, wer sie erwartet.</p></li>
        </ul>
      </div>
    </section>

    <section class="section section--alt" aria-labelledby="wege-title">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow" style="--eyebrow-dot: var(--c-sage-deep)">Zwei Wege</p>
          <h2 class="t-h2" id="wege-title">Gute Bilder<br><span class="t-serif-italic">für Ihren Auftritt.</span></h2>
        </header>
        <div class="umstieg__grid">
          <article class="card umstieg__card">
            <span class="icon-tile icon-tile--sand"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 015.5 7h2.3l1.4-2h5.6l1.4 2h2.3A1.5 1.5 0 0120 8.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></span>
            <h3 class="t-h3">Professionelles Fotoshooting</h3>
            <p class="t-small">Bei Ihnen vor Ort in Hamburg. Unser Fotograf setzt Ihren Laden, Ihre Produkte und Ihr Team ins beste Licht.</p>
          </article>
          <article class="card umstieg__card">
            <span class="icon-tile icon-tile--elbe"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5A1.5 1.5 0 015 6h4.2l1.8 2H19a1.5 1.5 0 011.5 1.5v8A1.5 1.5 0 0119 19H5a1.5 1.5 0 01-1.5-1.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 16l3-3 2 2 3-3 2 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
            <h3 class="t-h3">Ihre eigenen Bilder</h3>
            <p class="t-small">Wir arbeiten mit dem Material, das Sie uns geben oder schon haben: sorgfältig ausgewählt und aufbereitet.</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section" id="paket-max" aria-labelledby="max-title">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow" style="--eyebrow-dot: var(--c-rose-deep)">Website mit Fotos</p>
          <h2 class="t-h2" id="max-title">Im Paket Max<br><span class="t-serif-italic">schon enthalten.</span></h2>
          <p class="t-lead">Wer eine neue Website mit Bildern aus einem Guss möchte, bekommt im Paket Max alles zusammen.</p>
        </header>
        ${plans}
        ${plansNote}
      </div>
    </section>`,
  },
  {
    slug: 'software-hamburg',
    title: 'Software für Gastronomie &amp; Einzelhandel in Hamburg | Studio Elbquartier',
    description: 'Softwarelösungen aus Hamburg: Online-Reservierung, Vorbestellen und Abholen, Gutscheine, digitale Karten, Werkzeuge für Ihr Team und Automatisierung, zugeschnitten auf Ihren Betrieb.',
    crumb: 'Software Hamburg',
    h1: 'Software für Ihren Betrieb', h1b: 'aus Hamburg.',
    lead: 'Unser Schwerpunkt sind Websites. Doch im Alltag steckt oft noch mehr Potenzial. Darum entwickeln wir auch Programme, die genau zu Ihrem Betrieb passen und Ihnen Arbeit abnehmen.',
    ctas: '<a class="btn" href="/?interesse=Software#kontakt">Software-Idee besprechen</a><a class="btn btn--secondary" href="#loesungen">Beispiele ansehen</a>',
    service: { name: 'Softwarelösungen für Gastronomie und Einzelhandel in Hamburg', type: 'Softwareentwicklung' },
    body: `
    <section class="section section--alt" id="loesungen" aria-labelledby="loesungen-title">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow" style="--eyebrow-dot: var(--c-elbe-deep)">Softwarelösungen</p>
          <h2 class="t-h2" id="loesungen-title">Software, die Ihnen<br><span class="t-serif-italic">Arbeit abnimmt.</span></h2>
          <p class="t-lead">Zum Beispiel:</p>
        </header>
        ${software}
        <div class="cta-band">
          <div class="cta-band__text">
            <h3 class="t-h3">Ihre Idee ist nicht dabei?<br><span class="t-serif-italic">Erzählen Sie uns davon.</span></h3>
            <p class="t-small">Gemeinsam finden wir heraus, was sich für Ihren Betrieb lohnt: unverbindlich und ohne Fachchinesisch.</p>
          </div>
          <div class="cta-band__actions">
            <a class="btn" href="/?interesse=Software#kontakt">Software-Idee besprechen</a>
            <a class="btn btn--secondary" href="https://wa.me/4917631685816?text=Hallo%20Studio%20Elbquartier%2C%20ich%20habe%20eine%20Software-Idee." target="_blank" rel="noopener">Per WhatsApp</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="web-title">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow" style="--eyebrow-dot: var(--c-sand-deep)">Passt zusammen</p>
          <h2 class="t-h2" id="web-title">Software und Website<br><span class="t-serif-italic">aus einer Hand.</span></h2>
          <p class="t-lead">Reservierung, Vorbestellung oder digitale Karte sitzen direkt in Ihrer Website. <a class="services__link" href="/webdesign-hamburg/">Mehr über Webdesign in Hamburg</a></p>
        </header>
        ${beispiele(4)}
      </div>
    </section>`,
  },
];

for (const s of seiten) {
  mkdirSync(s.slug, { recursive: true });
  writeFileSync(`${s.slug}/index.html`, seite(s));
  console.log('geschrieben:', `${s.slug}/index.html`);
}
