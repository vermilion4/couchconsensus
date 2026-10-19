// Offline fallback poster art for the demo deck (SV-6: no third-party artwork): one flat motif per
// primary genre, title set in Bricolage Grotesque. The shipped posters are photo posters
// (build-photo-posters.mjs); point posterPath at the .png files to use these instead.
// Usage: node packages/catalog/scripts/build-posters.mjs   → packages/catalog/art/demo-NNNN.png
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';

const root = new URL('../../../', import.meta.url);
const deck = JSON.parse(readFileSync(new URL('packages/catalog/data/demo-deck.json', root), 'utf8'));
const out = new URL('packages/catalog/art/', root);
mkdirSync(out, {recursive: true});
const fonts = ['BricolageGrotesque-ExtraBold.ttf', 'Figtree-SemiBold.ttf'].map(f =>
  fileURLToPath(new URL(`design/fonts/static/${f}`, root)),
);

const W = 400;
const H = 600;
const NIGHT = '#0E1626';
const GLOW = '#F7F1E8';

// [background, accent] per genre
const PALETTE = {
  action: ['#C2410C', '#FFC23D'],
  adventure: ['#0F766E', '#FDE68A'],
  animation: ['#7C3AED', '#FDE68A'],
  comedy: ['#FFC23D', '#FC4C02'],
  crime: ['#111827', '#F87171'],
  documentary: ['#E8E1D7', '#25365A'],
  drama: ['#25365A', '#F7F1E8'],
  family: ['#5EE6A0', '#0E1626'],
  fantasy: ['#4C1D95', '#FCD34D'],
  horror: ['#14050A', '#DC2626'],
  mystery: ['#1E293B', '#93C5FD'],
  romance: ['#FF6FA8', '#FFF1F2'],
  scienceFiction: ['#4FB3FF', '#0E1626'],
  thriller: ['#0F172A', '#FC4C02'],
  war: ['#4B5320', '#E8E1D7'],
  western: ['#D97706', '#3F1D0B'],
  music: ['#9B8CFF', '#0E1626'],
  history: ['#78350F', '#FDE68A'],
};

// small deterministic RNG per title, so every poster differs but rebuilds identically
function rng(seed) {
  let a = [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const luminance = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ink = bg => (luminance(bg) > 0.3 ? NIGHT : GLOW);

// Motifs live in the lower part of the poster (y ≈ 260–560). r() varies size and position.
const MOTIFS = {
  western: (ac, r) => `<circle cx="${200 + (r() - 0.5) * 120}" cy="${380}" r="${70 + r() * 30}" fill="${ac}" opacity=".85"/>
    <path d="M0 470 L90 400 L150 430 L230 360 L320 420 L400 390 L400 600 L0 600Z" fill="${ac}"/>`,
  adventure: (ac, r) => `<path d="M-20 600 L${120 + r() * 40} ${330 + r() * 40} L250 600Z" fill="${ac}" opacity=".9"/>
    <path d="M140 600 L${290 + r() * 40} ${300 + r() * 40} L440 600Z" fill="${ac}"/>`,
  scienceFiction: (ac, r) => `<circle cx="${200 + (r() - 0.5) * 80}" cy="420" r="${80 + r() * 25}" fill="${ac}"/>
    <ellipse cx="200" cy="420" rx="170" ry="${28 + r() * 14}" fill="none" stroke="${GLOW}" stroke-width="10" transform="rotate(${-12 + r() * 24} 200 420)"/>`,
  horror: (ac, r) => `<circle cx="${130 + r() * 140}" cy="360" r="${46 + r() * 20}" fill="${ac}"/>
    ${[0, 1, 2, 3, 4].map(i => `<path d="M${i * 90 - 10 + r() * 20} 600 L${i * 90 + 30} ${420 + r() * 60} L${i * 90 + 70} 600Z" fill="#000"/>`).join('')}`,
  music: (ac, r) => [0, 1, 2, 3].map(i => `<circle cx="${200 + (r() - 0.5) * 40}" cy="430" r="${130 - i * 30}" fill="${i % 2 ? GLOW : ac}" opacity="${i % 2 ? 0.25 : 1}"/>`).join('') + `<circle cx="200" cy="430" r="14" fill="${GLOW}"/>`,
  romance: (ac, r) => `<circle cx="${160 - r() * 20}" cy="420" r="${85 + r() * 15}" fill="${ac}" opacity=".85"/>
    <circle cx="${240 + r() * 20}" cy="420" r="${85 + r() * 15}" fill="${NIGHT}" opacity=".25"/>`,
  crime: (ac, r) => `<circle cx="200" cy="${390 + r() * 20}" r="46" fill="${ac}"/><path d="M178 410 L222 410 L240 520 L160 520Z" fill="${ac}"/>
    <rect x="-20" y="${300 + r() * 40}" width="460" height="16" fill="${ac}" opacity=".35" transform="rotate(-18 200 330)"/>`,
  mystery: (ac, r) => [0, 1, 2, 3, 4].map(i => `<circle cx="${200 + i * (r() * 6)}" cy="430" r="${30 + i * 26}" fill="none" stroke="${ac}" stroke-width="${10 - i}" opacity="${1 - i * 0.15}"/>`).join(''),
  action: (ac, r) => [0, 1, 2].map(i => `<rect x="-60" y="${330 + i * 70 + r() * 20}" width="560" height="${26 + r() * 20}" fill="${ac}" transform="rotate(-24 200 430)"/>`).join(''),
  thriller: (ac, r) => `<path d="M0 ${430 + r() * 20} L80 360 L160 470 L240 380 L320 480 L400 ${390 + r() * 30}" fill="none" stroke="${ac}" stroke-width="14" stroke-linejoin="round"/>`,
  history: (ac, r) => [0, 1, 2].map(i => `<path d="M${30 + i * 120} 560 L${30 + i * 120} ${420 + r() * 20} A50 50 0 0 1 ${130 + i * 120} ${420 + r() * 20} L${130 + i * 120} 560Z" fill="${ac}" opacity="${0.6 + i * 0.2}"/>`).join(''),
  war: (ac, r) => `${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${i * 70}" y="${380 + r() * 40}" width="40" height="300" fill="${ac}" opacity=".25"/>`).join('')}<circle cx="${100 + r() * 200}" cy="350" r="40" fill="${ac}"/>`,
  family: (ac, r) => `<path d="M${110 + r() * 20} 560 L${110 + r() * 20} 430 L200 ${350 + r() * 20} L${290 - r() * 20} 430 L${290 - r() * 20} 560Z" fill="${ac}"/><rect x="180" y="480" width="40" height="80" fill="${GLOW}"/>`,
  animation: (ac, r) => {
    const cx = 200 + (r() - 0.5) * 60, cy = 430, R = 110, rr = 45;
    const pts = Array.from({length: 10}, (_, i) => {
      const a = (Math.PI / 5) * i - Math.PI / 2, rad = i % 2 ? rr : R;
      return `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
    });
    return `<polygon points="${pts.join(' ')}" fill="${ac}" transform="rotate(${r() * 30 - 15} ${cx} ${cy})"/>`;
  },
  fantasy: (ac, r) => `<rect x="${170 + r() * 20}" y="${360 + r() * 30}" width="60" height="240" fill="${ac}"/><path d="M${160 + r() * 20} 380 L${200 + r() * 10} ${290 + r() * 20} L${240 + r() * 10} 380Z" fill="${ac}"/>
    ${[0, 1, 2, 3, 4, 5].map(() => `<circle cx="${r() * 400}" cy="${270 + r() * 120}" r="${2 + r() * 3}" fill="${GLOW}"/>`).join('')}`,
  documentary: (ac, r) => [0, 1, 2, 3].map(i => `<rect x="0" y="${330 + i * 60}" width="${180 + r() * 220}" height="34" fill="${ac}" opacity="${0.25 + i * 0.2}"/>`).join(''),
  comedy: (ac, r) => Array.from({length: 12}, () => `<circle cx="${r() * 400}" cy="${300 + r() * 280}" r="${10 + r() * 34}" fill="${ac}" opacity="${0.5 + r() * 0.5}"/>`).join(''),
  drama: (ac, r) => `<circle cx="${200 + (r() - 0.5) * 80}" cy="${400}" r="44" fill="${ac}"/><rect x="${140 + (r() - 0.5) * 40}" y="455" width="120" height="160" rx="60" fill="${ac}"/>`,
};

function wrap(text, size, maxWidth) {
  const words = text.toUpperCase().split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length * size * 0.6 > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&apos;');

for (const t of deck.titles) {
  const primary = t.genres[0];
  const [bg, ac] = PALETTE[primary];
  const r = rng(t.id);
  let size = 50;
  let lines = wrap(t.title, size, 340);
  // shrink until it fits in 4 lines and no single word is wider than the poster
  const tooWide = ls => ls.some(l => l.length * size * 0.6 > 340);
  while (lines.length > 4 || tooWide(lines)) lines = wrap(t.title, (size -= 2), 340);
  const fg = ink(bg);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  ${MOTIFS[primary](ac, r)}
  ${lines.map((l, i) => `<text x="30" y="${66 + i * size * 1.02}" font-family="Bricolage Grotesque" font-weight="800" font-size="${size}" fill="${fg}">${esc(l)}</text>`).join('\n  ')}
  <rect x="0" y="${H - 52}" width="${W}" height="52" fill="${NIGHT}" opacity=".55"/>
  <text x="30" y="${H - 19}" font-family="Figtree" font-weight="600" font-size="18" fill="${GLOW}">${t.year}  ·  ${t.runtimeMin} min</text>
</svg>`;
  const png = new Resvg(svg, {font: {fontFiles: fonts, loadSystemFonts: false, defaultFontFamily: 'Figtree'}}).render().asPng();
  writeFileSync(new URL(t.posterPath.replace('/art/', '').replace(/\.\w+$/, '.png'), out), png);
}
console.log(`wrote ${deck.titles.length} posters to packages/catalog/art/`);
