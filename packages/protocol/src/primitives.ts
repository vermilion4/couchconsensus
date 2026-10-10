// Shared primitives (DATA_MODEL §2). Times are epoch milliseconds (UTC).
import {z} from 'zod';

/** 20 letters without look-alikes (I, L, O, S, V, Z dropped). ADR-0010. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRTUWXY';
export const RoomCode = z.string().regex(/^[ABCDEFGHJKMNPQRTUWXY]{4}$/, 'Room code is 4 letters');
export type RoomCode = z.infer<typeof RoomCode>;

export const VoterId = z.string().regex(/^v_[a-z2-7]{8}$/);
export type VoterId = z.infer<typeof VoterId>;

export const TitleId = z.string().regex(/^(demo|tmdb):[0-9]+$/);
export type TitleId = z.infer<typeof TitleId>;

export const ServiceId = z.string().min(1).max(40);
export type ServiceId = z.infer<typeof ServiceId>;

export const CountryCode = z.string().regex(/^[A-Z]{2}$/);
export type CountryCode = z.infer<typeof CountryCode>;

export const EpochMs = z.number().int().nonnegative();
export type EpochMs = z.infer<typeof EpochMs>;

export const CmdId = z.uuid();

export const Phase = z.enum(['lobby', 'dealing', 'voting', 'tally', 'suddenDeath', 'verdict', 'closed']);
export type Phase = z.infer<typeof Phase>;

export const RoundKind = z.enum(['main', 'suddenDeath']);
export type RoundKind = z.infer<typeof RoundKind>;

export const VoteValue = z.enum(['yes', 'no', 'superYes', 'veto']);
export type VoteValue = z.infer<typeof VoteValue>;

export const MoodChip = z.enum([
  'funny',
  'cozy',
  'thrilling',
  'scary',
  'romantic',
  'mindBending',
  'epic',
  'feelGood',
  'familyFriendly',
  'short',
]);
export type MoodChip = z.infer<typeof MoodChip>;

// Control, bidi and zero-width characters. Explicit ranges instead of \p{…} so the
// same regex is safe on Hermes (TV), browsers and Node.
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u00AD\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g;

/** Trimmed, 1–12 chars, no control or zero-width characters (Content NFR, ADR-0010). */
export const Nickname = z
  .string()
  .transform(s => s.replace(INVISIBLE, '').trim())
  .pipe(z.string().min(1, 'Enter a name').max(12, 'Max 12 characters'));

export const MoodText = z
  .string()
  .transform(s => s.replace(INVISIBLE, '').trim())
  .pipe(z.string().max(80));
