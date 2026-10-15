// Vorschaubilder der Beispiel-Websites für das Startbild der Startseite (assets/img/hero/<id>.webp).
// Fotografiert das Startbild jeder Beispielseite in Desktop-Größe (1280 × 800) und speichert es halb so groß als WebP.
// Voraussetzung: Dev-Server läuft (node tools/dev-server.mjs .) und puppeteer-core ist verfügbar.
// Aufruf im Projektordner:  node tools/hero-vorschau.mjs [Pfad zu chrome.exe]

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const CHROME = process.argv[2] || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PAGES = {
  juwelier: 'beispiele/juwelier/', blumen: 'beispiele/blumenladen/', restaurant: 'beispiele/restaurant/',
  cafe: 'beispiele/cafe/', bar: 'beispiele/bar/', boutique: 'beispiele/boutique/', autohaus: 'beispiele/autohaus/',
  getraenke: 'beispiele/getraenke/', immobilien: 'beispiele/immobilien/', brillen: 'beispiele/brillen/',
};
fs.mkdirSync('assets/img/hero', { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars'] });
for (const [id, path] of Object.entries(PAGES)) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 0.5 });
  await page.goto(`http://localhost:8765/${path}`, { waitUntil: 'load' });
  await page.addStyleTag({ content: '.demo-flag{display:none!important}' });
  await new Promise((r) => setTimeout(r, 6500)); // Intro-Animationen und 3D abwarten
  await page.screenshot({ path: `assets/img/hero/${id}.webp`, type: 'webp', quality: 72 });
  console.log(id, fs.statSync(`assets/img/hero/${id}.webp`).size, 'Bytes');
  await page.close();
}
await browser.close();
