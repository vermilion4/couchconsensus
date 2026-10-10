import {describe, expect, it} from 'vitest';
import {loadDemoCatalog} from './demo';

describe('demo catalog', () => {
  const cat = loadDemoCatalog();

  it('is valid and marked demo', () => {
    expect(cat.mode).toBe('demo');
    expect(cat.titles.length).toBeGreaterThan(0);
  });

  it('has unique title ids', () => {
    const ids = cat.titles.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only references services it defines, and contains no adult titles', () => {
    const services = new Set(cat.services.map(s => s.id));
    for (const t of cat.titles) {
      expect(t.adult).toBe(false);
      for (const a of Object.values(t.availability).flat()) expect(services.has(a.serviceId)).toBe(true);
    }
  });

  it.todo('has ≥ 60 titles, ≥ 2 per genre, runtimes 80–170 min (DATA_MODEL §7 demo-deck requirements)');
});
