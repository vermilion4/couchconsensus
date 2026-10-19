// The AI port (ADR-0008): two small tasks behind one interface, so Bedrock can be swapped for a fake
// in tests or for another model by config. Shapes follow DATA_MODEL §8.
import {z} from 'zod';
import type {MoodChip} from '@couch/protocol';

/** AI-1 input. Moods carry no names, in shuffled order; candidates already obey the ground rules. */
export interface DeckAsk {
  rules: {maxRuntimeMin: number | null; region: string};
  moods: {chips: MoodChip[]; text?: string}[];
  candidates: {id: string; title: string; year: number; genres: string[]; tags: string[]; logline: string}[];
  deckSize: number;
}

export const DeckAnswer = z.object({
  filters: z.object({genresBoost: z.array(z.string()), genresAvoid: z.array(z.string()), tones: z.array(z.string())}),
  shortlist: z.array(z.string()),
});
export type DeckAnswer = z.infer<typeof DeckAnswer>;

/** AI-2 input. Aggregates only: never voter names or who voted what. */
export interface ReasonAsk {
  winner: {title: string; year: number; genres: string[]; runtimeMin: number};
  runnerUp?: {title: string};
  stats: {voters: number; yes: number; superYes: number; unanimous: boolean};
  path: 'normal' | 'suddenDeath' | 'coinToss';
  roomMoods: MoodChip[];
}

export const ReasonAnswer = z.object({reason: z.string()});

export interface AiPort {
  deck(ask: DeckAsk, signal: AbortSignal): Promise<DeckAnswer>;
  reason(ask: ReasonAsk, signal: AbortSignal): Promise<string>;
}
