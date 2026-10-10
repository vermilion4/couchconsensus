// Ground rules (DATA_MODEL §3.2, US-2, TV-7).
import {z} from 'zod';
import {ServiceId} from './primitives';

export const MAX_RUNTIME_STEPS = [90, 105, 120, 150] as const;

export const GroundRules = z.object({
  /** Empty = every service in the catalog for this region. */
  services: z.array(ServiceId).max(30),
  /** null = no limit. */
  maxRuntimeMin: z.union([z.literal(90), z.literal(105), z.literal(120), z.literal(150), z.null()]),
  kind: z.literal('film'),
  includeAdult: z.literal(false),
  deckSize: z.literal(15),
  roundSeconds: z.literal(90),
});
export type GroundRules = z.infer<typeof GroundRules>;

export const DEFAULT_RULES: GroundRules = {
  services: [],
  maxRuntimeMin: null,
  kind: 'film',
  includeAdult: false,
  deckSize: 15,
  roundSeconds: 90,
};

export const SUDDEN_DEATH_CARDS = 5;
export const SUDDEN_DEATH_SECONDS = 30;
export const MAX_VOTERS = 8;
export const MIN_VOTERS_TO_START = 2;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
