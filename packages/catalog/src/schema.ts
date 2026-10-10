// Catalog file format (DATA_MODEL §7). Demo and real (TMDB snapshot) catalogs share it.
import {z} from 'zod';
import {CountryCode, ServiceId, TitleId} from '@couch/protocol';

export const Genre = z.enum([
  'action',
  'adventure',
  'animation',
  'comedy',
  'crime',
  'documentary',
  'drama',
  'family',
  'fantasy',
  'horror',
  'mystery',
  'romance',
  'scienceFiction',
  'thriller',
  'war',
  'western',
  'music',
  'history',
]);
export type Genre = z.infer<typeof Genre>;

/** Demo titles use the pseudo-country "ZZ" (region-agnostic). */
export const DEMO_REGION = 'ZZ';

export const Availability = z.object({
  serviceId: ServiceId,
  type: z.enum(['subscription', 'free', 'rent', 'buy']),
});

export const Service = z.object({
  id: ServiceId,
  name: z.string(),
  /** Never shown in demo mode (SV-6). */
  logoUrl: z.string().optional(),
  regions: z.array(z.union([CountryCode, z.literal(DEMO_REGION)])),
});
export type Service = z.infer<typeof Service>;

export const Title = z.object({
  id: TitleId,
  kind: z.literal('film'),
  title: z.string(),
  year: z.number().int().min(1900).max(2100),
  runtimeMin: z.number().int().positive(),
  genres: z.array(Genre).min(1),
  tags: z.array(z.string()),
  logline: z.string().max(120),
  adult: z.boolean(),
  certification: z.string().optional(),
  popularity: z.number().min(0).max(100),
  posterPath: z.string(),
  availability: z.record(z.string(), z.array(Availability)),
});
export type Title = z.infer<typeof Title>;

export const CatalogFile = z.object({
  schemaVersion: z.literal(1),
  mode: z.enum(['demo', 'real']),
  generatedAt: z.string(),
  attribution: z.array(z.string()).optional(),
  services: z.array(Service),
  titles: z.array(Title),
});
export type CatalogFile = z.infer<typeof CatalogFile>;
