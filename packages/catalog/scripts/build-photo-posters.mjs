// Builds the demo deck's posters from CC0 / public-domain photos (stock/selection.json, picked from
// Openverse by find-stock.mjs and reviewed by eye: no people, logos or brands). Each poster is the
// photo cropped to 2:3 under the invented title, so the demo still shows only original film names.
// Writes packages/catalog/art/demo-NNNN.jpg (600×900) and art/CREDITS.md. A pick's optional `align`
// (an SVG preserveAspectRatio, e.g. xMaxYMid) moves the crop to keep the subject in frame.
// Usage: node packages/catalog/scripts/build-photo-posters.mjs <cacheDir>
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';

const root = new URL('../../../', import.meta.url);
const deck = JSON.parse(readFileSync(new URL('packages/catalog/data/demo-deck.json', root), 'utf8'));
const selection = JSON.parse(readFileSync(new URL('packages/catalog/stock/selection.json', root), 'utf8'));
const art = fileURLToPath(new URL('packages/catalog/art/', root));
const cache = process.argv[2];
if (!cache) throw new Error('usage: build-photo-posters.mjs <cacheDir>');
mkdirSync(cache, {recursive: true});
const fonts = ['BricolageGrotesque-ExtraBold.ttf', 'Figtree-SemiBold.ttf'].map(f => fileURLToPath(new URL(`design/fonts/static/${f}`, root)));

const W = 600;
const H = 900;
const PAD = 45;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&apos;');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function wrap(text, size, maxWidth) {
  const lines = [];
  let line = '';
  for (const w of text.toUpperCase().split(' ')) {
    const next = line ? `${line} ${w}` : w;
    if (next.length * size * 0.6 > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

async function photo(id, pick) {
  const raw = `${cache}/${id}.src`;
  const small = `${cache}/${id}.jpg`;
  if (!existsSync(small)) {
    const res = await fetch(pick.url, {headers: {'user-agent': 'CouchConsensus-demo-art/1.0 (hackathon; github.com/vermilion4/couchconsensus)'}});
    if (!res.ok) throw new Error(`${id}: ${res.status} ${pick.url}`);
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    // Normalise to a 1200 px JPEG so every source format embeds the same way.
    execFileSync('sips', ['-s', 'format', 'jpeg', '-Z', '1200', raw, '--out', small], {stdio: 'ignore'});
    rmSync(raw);
    await sleep(500);
  }
  return readFileSync(small).toString('base64');
}

const credits = ['# Poster photo credits', '', 'Every demo poster uses a photo released as CC0 or marked public domain, found through [Openverse](https://openverse.org). No attribution is required; credit is given anyway. Titles on the posters are invented.', '', '| Film | Photo | Creator | Licence | Source |', '| --- | --- | --- | --- | --- |'];

for (const t of deck.titles) {
  const id = t.id.slice(5);
  const pick = selection[id];
  const b64 = await photo(id, pick);
  let size = 72;
  let lines = wrap(t.title, size, W - 2 * PAD);
  const tooWide = ls => ls.some(l => l.length * size * 0.6 > W - 2 * PAD);
  while (lines.length > 4 || tooWide(lines)) lines = wrap(t.title, (size -= 3), W - 2 * PAD);
  const titleBottom = 96 + (lines.length - 1) * size * 1.02;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="top" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0E1626" stop-opacity=".88"/>
      <stop offset="1" stop-color="#0E1626" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="bottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0E1626" stop-opacity="0"/>
      <stop offset="1" stop-color="#0E1626" stop-opacity=".85"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0E1626"/>
  <image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="${pick.align ?? 'xMidYMid'} slice" xlink:href="data:image/jpeg;base64,${b64}"/>
  <rect x="0" y="0" width="${W}" height="${Math.min(H, titleBottom + 150)}" fill="url(#top)"/>
  <rect x="0" y="${H - 170}" width="${W}" height="170" fill="url(#bottom)"/>
  ${lines.map((l, i) => `<text x="${PAD}" y="${96 + i * size * 1.02}" font-family="Bricolage Grotesque" font-weight="800" font-size="${size}" fill="#F7F1E8">${esc(l)}</text>`).join('\n  ')}
  <text x="${PAD}" y="${H - 34}" font-family="Figtree" font-weight="600" font-size="26" fill="#F7F1E8">${t.year}  ·  ${t.runtimeMin} min</text>
</svg>`;
  const png = new Resvg(svg, {font: {fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: 'Figtree'}}).render().asPng();
  const pngPath = `${cache}/poster-${id}.png`;
  writeFileSync(pngPath, png);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', pngPath, '--out', `${art}demo-${id}.jpg`], {stdio: 'ignore'});
  const license = pick.license === 'cc0' ? 'CC0 1.0' : 'Public Domain Mark';
  credits.push(`| ${t.title} | ${esc(pick.title ?? 'untitled').replace(/\|/g, '/')} | ${(pick.creator ?? 'unknown').replace(/\|/g, '/')} | ${license} | [${pick.source}](${pick.landing}) |`);
  console.log(id, t.title);
}
writeFileSync(`${art}CREDITS.md`, credits.join('\n') + '\n');
console.log(`wrote ${deck.titles.length} posters and art/CREDITS.md`);
