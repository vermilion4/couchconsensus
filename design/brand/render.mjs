// Renders design/brand/svg/*.svg to PNG with resvg. Usage: node design/brand/render.mjs
import {readFileSync, readdirSync, mkdirSync, writeFileSync} from 'node:fs';
import {Resvg} from '@resvg/resvg-js';

const dir = new URL('./svg/', import.meta.url);
const out = new URL('./png/', import.meta.url);
mkdirSync(out, {recursive: true});

// widths to export per file (px)
const sizes = {
  'mark.svg': [512, 192, 48],
  'mark-mono-glow.svg': [512],
  'mark-mono-orange.svg': [512],
  'app-icon.svg': [512, 192, 114, 48],
  'logo-stacked.svg': [1024],
  'lockup-horizontal.svg': [940],
  'tv-tile.svg': [1280],
};

for (const file of readdirSync(dir).filter(f => f.endsWith('.svg'))) {
  const svg = readFileSync(new URL(file, dir));
  for (const width of sizes[file] ?? [512]) {
    const png = new Resvg(svg, {fitTo: {mode: 'width', value: width}}).render().asPng();
    const name = file.replace('.svg', `-${width}.png`);
    writeFileSync(new URL(name, out), png);
    console.log(name, png.length, 'bytes');
  }
}
