// Referee engine inputs/outputs (DATA_MODEL §3.7).
import type {RoundKind, TitleId, VoteValue, VoterId} from '@couch/protocol';

export interface Card {
  index: number;
  titleId: TitleId;
}

export interface TallyInput {
  roundNo: number;
  /** Coin-toss seed component. */
  roomId: string;
  kind: RoundKind;
  deck: Card[];
  /** Every non-kicked voter seated before the round ended (late joiners included). */
  voterIds: VoterId[];
  /** Missing entries and unreached cards count as "no". */
  ballots: Record<VoterId, VoteValue[]>;
  /** SV-7: voter whose nickname hash matches household memory (ADR-0013). */
  priorSuperYesWinner?: VoterId;
}

export interface TitleScore {
  titleId: TitleId;
  /** yes = 1, superYes = 2 */
  points: number;
  /** yes + superYes */
  yes: number;
  superYes: number;
  /** includes unreached */
  no: number;
  vetoed: boolean;
  /** every voter voted yes or superYes */
  unanimous: boolean;
}

export interface CoinToss {
  candidates: TitleId[];
  winner: TitleId;
  seed: number;
}

export type TallyResult =
  | {kind: 'ranked'; ranking: TitleScore[]; coinToss?: CoinToss; scores: TitleScore[]}
  | {kind: 'suddenDeath'; reason: 'noYes' | 'allVetoed'; scores: TitleScore[]};
