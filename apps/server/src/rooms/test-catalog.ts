// Small fixed catalog for lifecycle and deck tests (invented titles, demo services).
import type {CatalogFile, Genre, Title} from '@couch/catalog';

const t = (n: number, genres: Genre[], runtimeMin: number, service: string, extra: Partial<Title> = {}): Title => ({
  id: `demo:${String(n).padStart(4, '0')}`,
  kind: 'film',
  title: `Test Film ${n}`,
  year: 2000 + n,
  runtimeMin,
  genres,
  tags: [],
  logline: `Logline ${n}.`,
  adult: false,
  popularity: 100 - n,
  posterPath: `/art/demo-${n}.webp`,
  availability: {ZZ: [{serviceId: service, type: 'subscription'}]},
  ...extra,
});

export const TEST_CATALOG: CatalogFile = {
  schemaVersion: 1,
  mode: 'demo',
  generatedAt: '2026-10-10',
  services: [
    {id: 'demo:streamco', name: 'StreamCo', regions: ['ZZ']},
    {id: 'demo:flixbox', name: 'FlixBox', regions: ['ZZ']},
  ],
  titles: [
    t(1, ['comedy'], 95, 'demo:streamco'),
    t(2, ['horror'], 100, 'demo:flixbox'),
    t(3, ['drama'], 150, 'demo:streamco'),
    t(4, ['comedy', 'family'], 88, 'demo:flixbox'),
    t(5, ['thriller'], 110, 'demo:streamco'),
    t(6, ['romance'], 105, 'demo:streamco'),
    t(7, ['action'], 130, 'demo:flixbox'),
    t(8, ['animation', 'family'], 90, 'demo:streamco'),
    t(9, ['scienceFiction'], 125, 'demo:flixbox'),
    t(10, ['documentary'], 85, 'demo:streamco'),
    t(11, ['crime'], 99, 'demo:streamco', {adult: true}),
  ],
};
