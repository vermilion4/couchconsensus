import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {loadDemoCatalog} from './demo';
import {Genre} from './schema';

const ART_DIR = fileURLToPath(new URL('../art/', import.meta.url));

describe('demo catalog', () => {
  const cat = loadDemoCatalog();

  it('is valid and marked demo', () => {
    expect(cat.mode).toBe('demo');
    expect(cat.titles.length).toBeGreaterThan(0);
  });

  it('has unique title ids and unique titles', () => {
    expect(new Set(cat.titles.map(t => t.id)).size).toBe(cat.titles.length);
    expect(new Set(cat.titles.map(t => t.title.toLowerCase())).size).toBe(cat.titles.length);
  });

  it('only references services it defines, and contains no adult titles', () => {
    const services = new Set(cat.services.map(s => s.id));
    for (const t of cat.titles) {
      expect(t.adult).toBe(false);
      for (const a of Object.values(t.availability).flat()) expect(services.has(a.serviceId)).toBe(true);
    }
  });

  // DATA_MODEL §7 demo-deck requirements: enough variety that rules and moods visibly change the deck.
  it('has at least 60 titles', () => {
    expect(cat.titles.length).toBeGreaterThanOrEqual(60);
  });

  it('covers every genre at least twice', () => {
    for (const g of Genre.options) expect(cat.titles.filter(t => t.genres.includes(g)).length, g).toBeGreaterThanOrEqual(2);
  });

  it('spreads runtimes from about 80 to 170 minutes', () => {
    const r = cat.titles.map(t => t.runtimeMin);
    expect(Math.min(...r)).toBeLessThanOrEqual(85);
    expect(Math.max(...r)).toBeGreaterThanOrEqual(160);
    expect(r.every(m => m >= 80 && m <= 170)).toBe(true);
    // the runtime rule must have room to bite: plenty of titles on both sides of 2 hours
    expect(r.filter(m => m <= 120).length).toBeGreaterThanOrEqual(25);
    expect(r.filter(m => m > 120).length).toBeGreaterThanOrEqual(15);
  });

  it('uses at least 3 invented services, each carrying a real share of the deck', () => {
    expect(cat.services.length).toBeGreaterThanOrEqual(3);
    for (const s of cat.services) {
      const n = cat.titles.filter(t => Object.values(t.availability).flat().some(a => a.serviceId === s.id)).length;
      expect(n, s.name).toBeGreaterThanOrEqual(15);
    }
  });

  it('has an original poster file for every title', () => {
    for (const t of cat.titles) {
      expect(t.posterPath).toMatch(/^\/art\/demo-\d{4}\.png$/);
      expect(existsSync(ART_DIR + t.posterPath.replace('/art/', '')), t.posterPath).toBe(true);
    }
  });
});
