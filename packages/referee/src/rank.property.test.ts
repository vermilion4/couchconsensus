// Property tests: the referee's guarantees hold for any room, not just hand-picked examples.
import fc from 'fast-check';
import {describe, expect, it} from 'vitest';
import type {VoteValue} from '@couch/protocol';
import {rankTitles} from './rank';
import type {TallyInput} from './types';

const vote = fc.constantFrom<VoteValue>('yes', 'no', 'superYes', 'veto');

/** A random room: 1–6 voters, 1–8 cards, each voter reached 0..all cards. */
const room = (kind: TallyInput['kind'] = 'main') =>
  fc
    .record({voters: fc.integer({min: 1, max: 6}), cards: fc.integer({min: 1, max: 8}), roomId: fc.string()})
    .chain(({voters, cards, roomId}) =>
      fc.tuple(
        fc.constant({voters, cards, roomId}),
        fc.array(fc.array(kind === 'main' ? vote : fc.constantFrom<VoteValue>('yes', 'no'), {maxLength: cards}), {
          minLength: voters,
          maxLength: voters,
        }),
      ),
    )
    .map(([{cards, roomId}, ballots]): TallyInput => {
      const voterIds = ballots.map((_, i) => `v${i}`);
      return {
        roundNo: 1,
        roomId,
        kind,
        deck: Array.from({length: cards}, (_, i) => ({index: i, titleId: `demo:${i + 1}`})),
        voterIds,
        ballots: Object.fromEntries(voterIds.map((id, i) => [id, ballots[i]!])),
      };
    });

describe('rankTitles properties', () => {
  it('a vetoed title never appears in the ranking', () => {
    fc.assert(
      fc.property(room(), input => {
        const r = rankTitles(input);
        if (r.kind !== 'ranked') return;
        const vetoed = new Set(r.scores.filter(s => s.vetoed).map(s => s.titleId));
        expect(r.ranking.some(t => vetoed.has(t.titleId))).toBe(false);
      }),
    );
  });

  it('a main round either asks for sudden death or ranks exactly the surviving titles, at least one with a yes', () => {
    fc.assert(
      fc.property(room(), input => {
        const r = rankTitles(input);
        const survivors = r.scores.filter(s => !s.vetoed);
        if (r.kind === 'suddenDeath') {
          expect(survivors.every(s => s.yes === 0)).toBe(true);
        } else {
          expect(r.ranking.map(t => t.titleId).sort()).toEqual(survivors.map(s => s.titleId).sort());
          expect(r.ranking[0]!.yes).toBeGreaterThan(0);
        }
      }),
    );
  });

  it('sudden death always ranks every card', () => {
    fc.assert(
      fc.property(room('suddenDeath'), input => {
        const r = rankTitles(input);
        expect(r.kind).toBe('ranked');
        if (r.kind === 'ranked') expect(r.ranking).toHaveLength(input.deck.length);
      }),
    );
  });

  it('voter order never changes the result', () => {
    fc.assert(
      fc.property(room(), input => {
        const reversed = {...input, voterIds: [...input.voterIds].reverse()};
        expect(rankTitles(reversed)).toEqual(rankTitles(input));
      }),
    );
  });

  it('upgrading a vote to super-yes never pushes that title down', () => {
    fc.assert(
      fc.property(room(), fc.nat(), fc.nat(), (input, voterPick, cardPick) => {
        const voter = input.voterIds[voterPick % input.voterIds.length]!;
        const card = cardPick % input.deck.length;
        const before = input.ballots[voter]![card] ?? 'no';
        if (before === 'veto' || before === 'superYes') return; // nothing to upgrade
        const ballot = [...input.ballots[voter]!];
        while (ballot.length <= card) ballot.push('no'); // reach the card
        ballot[card] = 'superYes';
        const after = {...input, ballots: {...input.ballots, [voter]: ballot}};

        const r0 = rankTitles({...input, ballots: {...input.ballots, [voter]: ballot.map((v, i) => (i === card ? before : v))}});
        const r1 = rankTitles(after);
        if (r0.kind !== 'ranked' || r1.kind !== 'ranked') return;
        const id = input.deck[card]!.titleId;
        const pos0 = r0.ranking.findIndex(t => t.titleId === id);
        const pos1 = r1.ranking.findIndex(t => t.titleId === id);
        if (pos0 === -1) return; // vetoed: stays out
        expect(pos1).toBeLessThanOrEqual(pos0);
      }),
    );
  });
});
