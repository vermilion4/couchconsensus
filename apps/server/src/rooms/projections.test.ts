import {randomUUID} from 'node:crypto';
import {describe, expect, it} from 'vitest';
import {TvView, VoterView, type ClientCommand, type VoteValue} from '@couch/protocol';
import {apply, newRoom, seatVoter} from './lifecycle';
import type {Actor, Ctx, Room} from './model';
import {projectTv, projectVoter} from './projections';
import {TEST_CATALOG} from './test-catalog';

const T0 = 1_791_648_000_000;
const ctx: Ctx = {now: T0, catalog: TEST_CATALOG};
const HOST: Actor = {role: 'host'};
// Voter ids in the real format (v_ + 8 base32 chars) so projections validate against the schema.
const id = (name: string) => `v_${name.padEnd(8, 'a')}`;
const cmd = (type: ClientCommand['type'], rest: Record<string, unknown> = {}) => ({type, cmdId: randomUUID(), ...rest}) as ClientCommand;

function room(): Room {
  const r = newRoom({code: 'KDRM', id: 'room-1', hostTokenHash: 'h', region: 'US', now: T0, joinUrl: 'https://x.test/r/KDRM'});
  for (const n of ['sam', 'ada']) seatVoter(r, {id: id(n), nickname: n, seatTokenHash: n}, T0);
  return r;
}
const vote = (r: Room, name: string, value: VoteValue) => {
  const round = r.rounds.at(-1)!;
  const v = id(name);
  return apply(r, {role: 'voter', voterId: v}, cmd('vote', {roundNo: round.no, cardIndex: round.ballots[v]?.votes.length ?? 0, value}), ctx);
};

const VOTE_VALUES = new Set(['yes', 'no', 'superYes', 'veto']);
/** Every string value anywhere in a JSON-like object (keys excluded). */
const stringValues = (x: unknown): string[] =>
  typeof x === 'string' ? [x] : x && typeof x === 'object' ? Object.values(x).flatMap(stringValues) : [];

describe('TV projection', () => {
  it('matches the protocol schema in the lobby', () => {
    const view = projectTv(room(), ctx);
    expect(TvView.parse(view)).toEqual(view);
    expect(view).toMatchObject({phase: 'lobby', canStart: true, joinUrl: 'https://x.test/r/KDRM'});
    expect(view.rules.availableServices.map(s => s.name)).toEqual(['StreamCo', 'FlixBox']);
  });

  it('shows progress counts but never a vote value (TV-4)', () => {
    const r = room();
    apply(r, HOST, cmd('startRound'), ctx);
    vote(r, 'sam', 'veto');
    vote(r, 'sam', 'superYes');
    const view = projectTv(r, ctx);
    expect(TvView.parse(view)).toEqual(view);
    expect(view.voters.find(v => v.id === id('sam'))!.progress).toEqual({done: 2, total: 10});
    expect(stringValues(view).filter(v => VOTE_VALUES.has(v))).toEqual([]);
  });

  it('shows the countdown with the server clock', () => {
    const r = room();
    apply(r, HOST, cmd('startRound'), ctx);
    expect(projectTv(r, ctx).round?.timer).toEqual({endsAt: T0 + 90_000, serverNow: T0, durationMs: 90_000});
  });

  it('shows the pick under the runner-up cursor', () => {
    const r = room();
    apply(r, HOST, cmd('startRound'), ctx);
    for (const n of ['sam', 'ada']) for (const v of ['yes', 'yes'] as const) vote(r, n, v);
    apply(r, HOST, cmd('endRound'), ctx);
    const first = projectTv(r, ctx).verdict!;
    expect(first).toMatchObject({isRunnerUp: false, hasNextRunnerUp: true});
    apply(r, HOST, cmd('runnerUp'), ctx);
    const second = projectTv(r, ctx).verdict!;
    expect(second.isRunnerUp).toBe(true);
    expect(second.title.id).toBe(r.verdict!.rankingIds[1]);
    expect(second.title.availability[0]?.serviceName).toBeDefined();
    expect(second.reason).toBe(`Next best: 2 of you said yes to ${second.title.title}.`);
    apply(r, HOST, cmd('runnerUp'), ctx); // card 3: nobody reached it
    expect(projectTv(r, ctx).verdict!.reason).toBe(`Next on the referee's list: ${projectTv(r, ctx).verdict!.title.title}.`);
  });
});

describe('voter projection', () => {
  it('gives my colour (seat order, as on the TV) and who has finished, without names or votes', () => {
    const r = room();
    apply(r, HOST, cmd('startRound'), ctx);
    const n = r.rounds[0]!.deck.length;
    for (let i = 0; i < n; i++) vote(r, 'ada', 'no');
    const view = projectVoter(r, id('ada'), ctx);
    expect(VoterView.parse(view)).toEqual(view);
    expect(view.me.colorIndex).toBe(1);
    expect(view.round?.progress).toEqual([
      {colorIndex: 0, finished: false},
      {colorIndex: 1, finished: true},
    ]);
    expect(JSON.stringify(view.round?.progress)).not.toMatch(/Sam|sam|Ada|ada|no/);
  });

  it('matches the protocol schema and carries only my own votes', () => {
    const r = room();
    apply(r, HOST, cmd('startRound'), ctx);
    vote(r, 'sam', 'veto');
    vote(r, 'ada', 'superYes');
    const view = projectVoter(r, id('sam'), ctx);
    expect(VoterView.parse(view)).toEqual(view);
    expect(view.me.ballot).toEqual({votes: ['veto'], vetoAvailable: false, superYesAvailable: true, finished: false});
    expect(JSON.stringify(view)).not.toContain('superYes"]'); // Ada's ballot never appears
    expect(view.round?.deck).toHaveLength(10);
  });

  it('tells me how I voted on the pick (Result screen, PH-4)', () => {
    const r = room();
    apply(r, HOST, cmd('startRound'), ctx);
    vote(r, 'sam', 'superYes');
    vote(r, 'ada', 'yes');
    apply(r, HOST, cmd('endRound'), ctx);
    expect(projectVoter(r, id('sam'), ctx).result).toMatchObject({myVote: 'superYes'});
    expect(projectVoter(r, id('ada'), ctx).result).toMatchObject({myVote: 'yes'});
  });

  it('says "notReached" when I never got to the winning card', () => {
    const r = room();
    apply(r, HOST, cmd('startRound'), ctx);
    vote(r, 'sam', 'no');
    vote(r, 'sam', 'yes'); // card 2 wins; Ada voted on nothing
    apply(r, HOST, cmd('endRound'), ctx);
    expect(projectVoter(r, id('ada'), ctx).result?.myVote).toBe('notReached');
  });
});
