// WebSocket + REST messages (DATA_MODEL §5). Every inbound message is parsed with these schemas.
import {z} from 'zod';
import {CmdId, CountryCode, EpochMs, MoodChip, MoodText, Nickname, RoomCode, VoteValue, VoterId} from './primitives';
import {GroundRules} from './rules';
import {TvView, VoterView} from './views';

export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 8 * 1024;

// ---------- REST ----------

export const CreateRoomRequest = z.object({
  clientInstallId: z.string().min(8).max(64),
  deviceLocale: z.string().max(35).optional(),
});
export const CreateRoomResponse = z.object({
  roomCode: RoomCode,
  joinUrl: z.url(),
  hostToken: z.string().min(32),
  region: CountryCode,
});

export const JoinRoomRequest = z.object({nickname: Nickname});
export const JoinRoomResponse = z.object({
  voterId: VoterId,
  seatToken: z.string().min(32),
  nickname: z.string(),
});

// ---------- client → server ----------

const cmd = <T extends string, S extends z.ZodRawShape>(type: T, shape: S) =>
  z.object({type: z.literal(type), cmdId: CmdId, ...shape});

export const HostCommand = z.discriminatedUnion('type', [
  cmd('setRules', {
    rules: GroundRules.pick({services: true, maxRuntimeMin: true}).partial().extend({region: CountryCode.optional()}),
  }),
  cmd('startRound', {}),
  cmd('endRound', {}),
  cmd('runnerUp', {}),
  cmd('rematch', {}),
  cmd('kickVoter', {voterId: VoterId}),
  cmd('closeRoom', {}),
]);
export type HostCommand = z.infer<typeof HostCommand>;

export const VoterCommand = z.discriminatedUnion('type', [
  cmd('setMood', {chips: z.array(MoodChip).max(3), text: MoodText.optional(), skipped: z.boolean().optional()}),
  cmd('vote', {roundNo: z.number().int().positive(), cardIndex: z.number().int().min(0).max(14), value: VoteValue}),
  cmd('undo', {roundNo: z.number().int().positive(), cardIndex: z.number().int().min(0).max(14)}),
  cmd('leave', {}),
]);
export type VoterCommand = z.infer<typeof VoterCommand>;

export const ClientCommand = z.union([HostCommand, VoterCommand]);
export type ClientCommand = z.infer<typeof ClientCommand>;

export const Hello = z.object({
  type: z.literal('hello'),
  roomCode: RoomCode,
  role: z.enum(['host', 'voter']),
  token: z.string().min(32).max(128),
  lastRev: z.number().int().nonnegative().optional(),
});
export type Hello = z.infer<typeof Hello>;

export const Ping = z.object({type: z.literal('ping'), t: EpochMs});

export const ClientMessage = z.union([Hello, Ping, HostCommand, VoterCommand]);
export type ClientMessage = z.infer<typeof ClientMessage>;

// ---------- server → client ----------

export const ErrorCode = z.enum([
  'BAD_MESSAGE',
  'UNAUTHORIZED',
  'ROOM_NOT_FOUND',
  'ROOM_EXPIRED',
  'ROOM_FULL',
  'WRONG_PHASE',
  'NOT_ENOUGH_VOTERS',
  'STALE_CARD',
  'ROUND_OVER',
  'VETO_USED',
  'SUPER_YES_USED',
  'NOT_ALLOWED_THIS_ROUND',
  'NICKNAME_INVALID',
  'RATE_LIMITED',
  'NO_RUNNER_UP',
  'INTERNAL',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ServerMessage = z.discriminatedUnion('type', [
  z.object({type: z.literal('welcome'), role: z.enum(['host', 'voter']), voterId: VoterId.optional(), protocol: z.literal(PROTOCOL_VERSION)}),
  z.object({type: z.literal('view'), view: z.union([TvView, VoterView])}),
  z.object({type: z.literal('ack'), cmdId: CmdId, ok: z.literal(true), rev: z.number().int()}),
  z.object({type: z.literal('nack'), cmdId: CmdId, ok: z.literal(false), error: ErrorCode, message: z.string()}),
  z.object({type: z.literal('pong'), t: EpochMs, serverNow: EpochMs}),
  z.object({type: z.literal('error'), error: ErrorCode, message: z.string(), fatal: z.boolean()}),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

/** WebSocket close codes (DATA_MODEL §5.3). */
export const CloseCode = {unauthorized: 4401, roomGone: 4404, idle: 4408} as const;
