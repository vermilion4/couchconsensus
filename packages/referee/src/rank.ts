import type {VoteValue} from '@couch/protocol';
import {seededShuffle, seedFrom} from './random';
import type {CoinToss, TallyInput, TallyResult, TitleScore} from './types';

const POINTS: Record<VoteValue, number> = {yes: 1, superYes: 2, no: 0, veto: 0};

/**
 * Applies the referee rules (ADR-0007) and returns the full ranking, or asks for sudden death.
 *
 * Order: unanimous titles first → more points → fewer No → more super-yes → household memory
 * (the last super-yes winner's pick, SV-7) → seeded coin toss.
 */
export function rankTitles(input: TallyInput): TallyResult {
  const scored = input.deck.map(card => ({card: card.index, score: score(input, card.index, card.titleId)}));
  const scores = scored.map(s => s.score);
  const survivors = scored.filter(s => !s.score.vetoed);

  if (input.kind === 'main') {
    if (survivors.length === 0) return {kind: 'suddenDeath', reason: 'allVetoed', scores};
    if (!survivors.some(s => s.score.yes > 0)) return {kind: 'suddenDeath', reason: 'noYes', scores};
  }

  const household = (card: number) =>
    input.priorSuperYesWinner !== undefined && input.ballots[input.priorSuperYesWinner]?.[card] === 'superYes';

  const compare = (a: (typeof survivors)[number], b: (typeof survivors)[number]) =>
    Number(b.score.unanimous) - Number(a.score.unanimous) ||
    b.score.points - a.score.points ||
    a.score.no - b.score.no ||
    b.score.superYes - a.score.superYes ||
    Number(household(b.card)) - Number(household(a.card));

  survivors.sort(compare);

  // Runs of titles tied on every rule are ordered by a seeded coin toss.
  const ranking: TitleScore[] = [];
  let coinToss: CoinToss | undefined;
  for (let i = 0; i < survivors.length; ) {
    let j = i + 1;
    while (j < survivors.length && compare(survivors[i]!, survivors[j]!) === 0) j++;
    const run = survivors.slice(i, j).map(s => s.score);
    if (run.length > 1) {
      const candidates = run.map(s => s.titleId).sort();
      const seed = seedFrom(`${input.roomId}|${input.roundNo}|${input.kind}|${candidates.join(',')}`);
      const order = seededShuffle(run, seed);
      if (i === 0) coinToss = {candidates, winner: order[0]!.titleId, seed};
      ranking.push(...order);
    } else {
      ranking.push(...run);
    }
    i = j;
  }

  return coinToss ? {kind: 'ranked', ranking, coinToss, scores} : {kind: 'ranked', ranking, scores};
}

function score(input: TallyInput, cardIndex: number, titleId: string): TitleScore {
  const s: TitleScore = {titleId, points: 0, yes: 0, superYes: 0, no: 0, vetoed: false, unanimous: false};
  for (const voter of input.voterIds) {
    const vote = input.ballots[voter]?.[cardIndex] ?? 'no';
    s.points += POINTS[vote];
    if (vote === 'yes' || vote === 'superYes') s.yes++;
    if (vote === 'superYes') s.superYes++;
    if (vote === 'no') s.no++;
    if (vote === 'veto') s.vetoed = true;
  }
  s.unanimous = input.voterIds.length > 0 && s.yes === input.voterIds.length;
  return s;
}
