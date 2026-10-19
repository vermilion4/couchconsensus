// Audience projections (DATA_MODEL §6). The TV view never carries a vote value (invariant I8).
import {z} from 'zod';
import {CountryCode, EpochMs, MoodChip, MoodText, Phase, RoomCode, RoundKind, ServiceId, TitleId, VoteValue, VoterId} from './primitives';
import {GroundRules} from './rules';

export const TitleCard = z.object({
  id: TitleId,
  title: z.string(),
  year: z.number().int(),
  runtimeMin: z.number().int().positive(),
  genres: z.array(z.string()).max(3),
  logline: z.string().max(120),
  posterUrl: z.string(),
  availability: z.array(z.object({serviceName: z.string(), type: z.enum(['subscription', 'free', 'rent', 'buy'])})),
});
export type TitleCard = z.infer<typeof TitleCard>;

export const TimerView = z.object({endsAt: EpochMs, serverNow: EpochMs, durationMs: z.number().int().positive()});
export type TimerView = z.infer<typeof TimerView>;

export const VerdictStats = z.object({
  voters: z.number().int(),
  yes: z.number().int(),
  superYes: z.number().int(),
  unanimous: z.boolean(),
});

export const TvView = z.object({
  audience: z.literal('tv'),
  rev: z.number().int().nonnegative(),
  serverNow: EpochMs,
  roomCode: RoomCode,
  joinUrl: z.string(),
  phase: Phase,
  rules: GroundRules.extend({
    region: CountryCode,
    availableServices: z.array(z.object({id: ServiceId, name: z.string()})),
  }),
  voters: z.array(
    z.object({
      id: VoterId,
      nickname: z.string(),
      connected: z.boolean(),
      moodDone: z.boolean(),
      // counts only, never values (TV-4, I8)
      progress: z.object({done: z.number().int(), total: z.number().int()}),
      finished: z.boolean(),
    }),
  ),
  canStart: z.boolean(),
  round: z.object({no: z.number().int(), kind: RoundKind, timer: TimerView, deckSize: z.number().int()}).optional(),
  verdict: z
    .object({
      title: TitleCard,
      reason: z.string(),
      isRunnerUp: z.boolean(),
      hasNextRunnerUp: z.boolean(),
      viaSuddenDeath: z.boolean(),
      coinToss: z.object({candidates: z.array(TitleCard), winnerId: TitleId}).optional(),
      stats: VerdictStats,
    })
    .optional(),
});
export type TvView = z.infer<typeof TvView>;

export const VoterView = z.object({
  audience: z.literal('voter'),
  rev: z.number().int().nonnegative(),
  serverNow: EpochMs,
  roomCode: RoomCode,
  phase: Phase,
  me: z.object({
    id: VoterId,
    nickname: z.string(),
    /** My place among seated voters; picks my colour, the same one the TV shows (theme voterColor). */
    colorIndex: z.number().int().nonnegative().optional(),
    mood: z.object({chips: z.array(MoodChip), text: MoodText.optional(), skipped: z.boolean()}).optional(),
    ballot: z
      .object({
        votes: z.array(VoteValue), // MY votes only
        vetoAvailable: z.boolean(),
        superYesAvailable: z.boolean(),
        finished: z.boolean(),
      })
      .optional(),
  }),
  roomSize: z.number().int(),
  round: z
    .object({
      no: z.number().int(),
      kind: RoundKind,
      timer: TimerView,
      deck: z.array(TitleCard),
      allowVeto: z.boolean(),
      allowSuperYes: z.boolean(),
      /** Who has finished (by colour), for the waiting screen. No names, no votes. */
      progress: z.array(z.object({colorIndex: z.number().int().nonnegative(), finished: z.boolean()})).optional(),
    })
    .optional(),
  result: z
    .object({
      title: TitleCard,
      reason: z.string(),
      myVote: z.union([VoteValue, z.literal('notReached'), z.literal('notInRound')]),
    })
    .optional(),
});
export type VoterView = z.infer<typeof VoterView>;
