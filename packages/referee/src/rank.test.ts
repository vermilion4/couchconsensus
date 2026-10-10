import {describe, expect, it} from 'vitest';
import type {VoteValue} from '@couch/protocol';
import {rankTitles} from './rank';
import type {TallyInput} from './types';

// Builds a TallyInput from a readable table: {voter: [vote per card]}.
function tally(ballots: Record<string, VoteValue[]>, cards: number, extra: Partial<TallyInput> = {}): TallyInput {
  return {
    roundNo: 1,
    roomId: 'room-1',
    kind: 'main',
    deck: Array.from({length: cards}, (_, i) => ({index: i, titleId: `demo:${i + 1}`})),
    voterIds: Object.keys(ballots),
    ballots,
    ...extra,
  };
}

const rankedIds = (input: TallyInput) => {
  const r = rankTitles(input);
  if (r.kind !== 'ranked') throw new Error(`expected a ranking, got ${r.kind}`);
  return r.ranking.map(t => t.titleId);
};

// Cases from the requirements ("How the referee decides") and ADR-0007.
describe('rankTitles', () => {
  it('worked example: Film B (unanimous, 3 pts) beats Film A (3 pts, not unanimous); Film C removed by veto', () => {
    //            Film A      Film B  Film C
    const input = tally(
      {
        sam: ['yes', 'yes', 'superYes'],
        ada: ['superYes', 'yes', 'veto'],
        kofi: ['no', 'yes', 'yes'],
      },
      3,
    );
    expect(rankedIds(input)).toEqual(['demo:2', 'demo:1']);
  });

  it('unreached cards count as No', () => {
    // Kofi stopped after card 1: his missing vote on card 2 is a No, so card 2 is not unanimous.
    const r = rankTitles(tally({sam: ['yes', 'yes'], kofi: ['yes']}, 2));
    expect(r.scores[1]).toMatchObject({titleId: 'demo:2', yes: 1, no: 1, unanimous: false});
    expect(rankedIds(tally({sam: ['yes', 'yes'], kofi: ['yes']}, 2))).toEqual(['demo:1', 'demo:2']);
  });
  it('asks for sudden death when no surviving title has a yes', () => {
    // Card 1 has a yes but is vetoed; card 2 has only Nos.
    const r = rankTitles(tally({sam: ['yes', 'no'], ada: ['veto', 'no']}, 2));
    expect(r).toMatchObject({kind: 'suddenDeath', reason: 'noYes'});
  });

  it('asks for sudden death when every title is vetoed', () => {
    const r = rankTitles(tally({sam: ['veto', 'yes'], ada: ['yes', 'veto']}, 2));
    expect(r).toMatchObject({kind: 'suddenDeath', reason: 'allVetoed'});
  });
  it('a points tie breaks by fewer No votes', () => {
    // Both 2 points, neither unanimous. Card 1: one super-yes + two Nos. Card 2: two yes + one No.
    const input = tally({sam: ['superYes', 'yes'], ada: ['no', 'yes'], kofi: ['no', 'no']}, 2);
    expect(rankedIds(input)).toEqual(['demo:2', 'demo:1']);
  });

  // Note: "more super-yes" can never decide on its own. With every card either voted or counted as No,
  // and vetoed cards removed, equal points + equal Nos force equal super-yes counts (ADR-0007).

  it('a full tie breaks for the title the household\'s last super-yes winner super-yessed', () => {
    // Identical scores; Ada (last time's winner) super-yessed card 2.
    const input = tally({sam: ['superYes', 'yes'], ada: ['yes', 'superYes']}, 2, {priorSuperYesWinner: 'ada'});
    const r = rankTitles(input);
    expect(r.kind === 'ranked' && r.ranking[0]?.titleId).toBe('demo:2');
    expect(r.kind === 'ranked' && r.coinToss).toBeUndefined();
  });

  it('a full tie with no household preference is settled by a coin toss that is reported', () => {
    const input = tally({sam: ['yes', 'yes'], ada: ['yes', 'yes']}, 2);
    const r = rankTitles(input);
    if (r.kind !== 'ranked') throw new Error('expected ranked');
    expect(r.coinToss?.candidates.sort()).toEqual(['demo:1', 'demo:2']);
    expect(r.ranking[0]?.titleId).toBe(r.coinToss?.winner);
  });

  it('the coin toss is reproducible for the same room, round and titles', () => {
    const input = tally({sam: ['yes', 'yes', 'yes'], ada: ['yes', 'yes', 'yes']}, 3);
    expect(rankedIds(input)).toEqual(rankedIds(input));
  });

  it('the coin toss can land either way across rooms', () => {
    const winners = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const r = rankTitles(tally({sam: ['yes', 'yes'], ada: ['yes', 'yes']}, 2, {roomId: `room-${i}`}));
      if (r.kind === 'ranked' && r.coinToss) winners.add(r.coinToss.winner);
    }
    expect([...winners].sort()).toEqual(['demo:1', 'demo:2']);
  });

  it('sudden death always returns a winner, even when every vote is No', () => {
    const r = rankTitles(tally({sam: ['no', 'no', 'no'], ada: ['no', 'no', 'no']}, 3, {kind: 'suddenDeath'}));
    if (r.kind !== 'ranked') throw new Error('sudden death must never ask for another sudden death');
    expect(r.ranking).toHaveLength(3);
    expect(r.coinToss?.candidates).toHaveLength(3);
  });

  it('result does not depend on voter order', () => {
    const ballots: Record<string, VoteValue[]> = {sam: ['yes', 'yes', 'no'], ada: ['yes', 'yes', 'yes'], kofi: ['superYes', 'no', 'yes']};
    const forward = tally(ballots, 3);
    const reversed = {...forward, voterIds: [...forward.voterIds].reverse()};
    expect(rankTitles(reversed)).toEqual(rankTitles(forward));
  });
});
