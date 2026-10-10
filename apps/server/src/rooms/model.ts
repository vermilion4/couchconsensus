// Server-side room state (DATA_MODEL §3). Authoritative; clients only ever see projections.
import type {CatalogFile} from '@couch/catalog';
import type {CoinToss, TallyResult} from '@couch/referee';
import type {ErrorCode, GroundRules, MoodChip, Phase, RoundKind, TitleId, VoteValue} from '@couch/protocol';

export interface Voter {
  id: string;
  nickname: string;
  seatTokenHash: string;
  /** Order of joining; picks the voter's color (packages/theme voterColor). */
  joinIndex: number;
  joinedAt: number;
  /** 0 = joined in the lobby; n = joined while round n was running (late joiner, US-11). */
  joinedRoundNo: number;
  connected: boolean;
  lastSeenAt: number;
  kicked: boolean;
  /** Last 64 command ids from this seat (idempotency, ADR-0004). */
  recentCmdIds: string[];
}

export interface Mood {
  voterId: string;
  chips: MoodChip[];
  text?: string;
  skipped: boolean;
  at: number;
}

export interface Card {
  index: number;
  titleId: TitleId;
}

export interface Ballot {
  votes: VoteValue[];
  finishedAt?: number;
}

export interface Round {
  no: number;
  kind: RoundKind;
  /** For sudden death: the main round it resolves. */
  parentNo?: number;
  deck: Card[];
  deckSource: 'ai' | 'rules';
  startedAt: number;
  endsAt: number;
  endedAt?: number;
  endReason?: 'allDone' | 'timer' | 'host';
  allowVeto: boolean;
  allowSuperYes: boolean;
  ballots: Record<string, Ballot>;
  result?: TallyResult;
}

export interface Verdict {
  roundNo: number;
  winner: TitleId;
  rankingIds: TitleId[];
  reason: string;
  reasonSource: 'ai' | 'template';
  viaSuddenDeath: boolean;
  coinToss?: CoinToss;
  stats: {voters: number; yes: number; superYes: number; unanimous: boolean};
  decidedAt: number;
}

export interface Room {
  schemaVersion: 1;
  id: string;
  code: string;
  rev: number;
  phase: Phase;
  createdAt: number;
  expiresAt: number;
  hostTokenHash: string;
  /** What the QR code encodes. */
  joinUrl: string;
  clientInstallId?: string;
  region: string;
  rules: GroundRules;
  voters: Voter[];
  moods: Mood[];
  rounds: Round[];
  /** Index into verdict.rankingIds currently on screen (Runner-up advances it). */
  verdictCursor: number;
  verdict?: Verdict;
  hostLastSeenAt: number;
  /** Last 64 command ids from the TV (idempotency, ADR-0004). */
  hostRecentCmdIds?: string[];
}

export type Actor = {role: 'host'} | {role: 'voter'; voterId: string};

export interface Ctx {
  now: number;
  catalog: CatalogFile;
}

export type Result = {ok: true} | {ok: false; error: ErrorCode; message: string};
export const OK: Result = {ok: true};
export const fail = (error: ErrorCode, message: string): Result => ({ok: false, error, message});
