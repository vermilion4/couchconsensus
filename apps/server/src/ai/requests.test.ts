import {describe, expect, it} from 'vitest';
import {DEFAULT_RULES} from '@couch/protocol';
import type {Room} from '../rooms/model';
import {TEST_CATALOG} from '../rooms/test-catalog';
import {deckAsk, reasonAsk} from './requests';

function room(extra: Partial<Room> = {}): Room {
  return {
    schemaVersion: 1,
    id: 'room-1',
    code: 'KDRM',
    rev: 0,
    phase: 'lobby',
    createdAt: 0,
    expiresAt: 1e15,
    hostTokenHash: 'h',
    joinUrl: 'http://x/r/KDRM',
    region: 'US',
    rules: {...DEFAULT_RULES},
    voters: [
      {id: 'sam', nickname: 'Sam', seatTokenHash: 's', joinIndex: 0, joinedAt: 0, joinedRoundNo: 0, connected: true, lastSeenAt: 0, kicked: false, recentCmdIds: []},
      {id: 'ada', nickname: 'Ada', seatTokenHash: 'a', joinIndex: 1, joinedAt: 0, joinedRoundNo: 0, connected: true, lastSeenAt: 0, kicked: false, recentCmdIds: []},
    ],
    moods: [
      {voterId: 'sam', chips: ['funny', 'cozy'], text: 'something with Sam in it', skipped: false, at: 0},
      {voterId: 'ada', chips: ['cozy'], skipped: false, at: 0},
    ],
    rounds: [],
    verdictCursor: 0,
    hostLastSeenAt: 0,
    ...extra,
  };
}

describe('deckAsk', () => {
  it('sends moods without voter ids or names, and only candidates that obey the rules', () => {
    const ask = deckAsk(room({rules: {...DEFAULT_RULES, maxRuntimeMin: 90}}), TEST_CATALOG)!;
    expect(JSON.stringify(ask)).not.toMatch(/"sam"|"ada"|voterId|nickname/);
    expect(JSON.stringify(ask)).not.toContain('Sam'); // a nickname typed into the mood text is scrubbed
    expect(ask.moods).toHaveLength(2);
    expect(ask.candidates.length).toBeGreaterThan(0);
    for (const c of ask.candidates) expect(TEST_CATALOG.titles.find(t => t.id === c.id)!.runtimeMin).toBeLessThanOrEqual(90);
    expect(ask.rules).toEqual({maxRuntimeMin: 90, region: 'US'});
    expect(ask.deckSize).toBe(15);
  });

  it('leaves out moods that were skipped, and returns nothing to ask when nobody gave one', () => {
    const skipped = room({moods: [{voterId: 'sam', chips: [], skipped: true, at: 0}]});
    expect(deckAsk(skipped, TEST_CATALOG)).toBeUndefined();
  });
});

describe('reasonAsk', () => {
  it('sends the winner, the runner-up and aggregate stats, never names', () => {
    const [w, r, other] = TEST_CATALOG.titles;
    const ask = reasonAsk(
      room({
        phase: 'tally',
        rounds: [
          {no: 1, kind: 'main', deck: [w!, r!, other!].map((t, index) => ({index, titleId: t.id})), deckSource: 'rules', startedAt: 0, endsAt: 1, allowVeto: true, allowSuperYes: true, ballots: {}},
        ],
        verdict: {roundNo: 1, winner: w!.id, rankingIds: [w!.id, r!.id, other!.id], reason: 't', reasonSource: 'template', viaSuddenDeath: false, stats: {voters: 2, yes: 2, superYes: 1, unanimous: true}, decidedAt: 1},
      }),
      TEST_CATALOG,
    )!;
    expect(ask.request).toMatchObject({winner: {title: w!.title}, runnerUp: {title: r!.title}, stats: {voters: 2, yes: 2, superYes: 1, unanimous: true}, path: 'normal'});
    expect(ask.request.roomMoods[0]).toBe('cozy'); // most common first
    expect(ask.titles).toEqual({winner: w!.title, runnerUp: r!.title, others: [r!.title, other!.title]});
    expect(JSON.stringify(ask.request)).not.toMatch(/Sam|Ada|"sam"|"ada"/);
  });
});
