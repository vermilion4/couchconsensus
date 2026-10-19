import {randomUUID} from 'node:crypto';
import {beforeEach, describe, expect, it} from 'vitest';
import type {ClientCommand, VoteValue} from '@couch/protocol';
import {deckInputsKey} from './deck';
import {REVEAL_DEADLINE_MS, apply, newRoom, onTick, revealVerdict, seatVoter, setConnected} from './lifecycle';
import type {Actor, Ctx, Room} from './model';
import {TEST_CATALOG} from './test-catalog';

const HOST: Actor = {role: 'host'};
const voter = (id: string): Actor => ({role: 'voter', voterId: id});
const T0 = 1_791_648_000_000;

let now = T0;
const ctx = (): Ctx => ({now, catalog: TEST_CATALOG});

// Command helpers. Each call gets a fresh cmdId unless one is given.
const cmd = <T extends ClientCommand['type']>(type: T, rest: Record<string, unknown> = {}) =>
  ({type, cmdId: randomUUID(), ...rest}) as Extract<ClientCommand, {type: T}>;
const vote = (room: Room, id: string, value: VoteValue) => {
  const round = room.rounds.at(-1)!;
  const cardIndex = round.ballots[id]?.votes.length ?? 0;
  return apply(room, voter(id), cmd('vote', {roundNo: round.no, cardIndex, value}), ctx());
};
const voteAll = (room: Room, id: string, values: VoteValue[]) => values.forEach(v => expect(vote(room, id, v)).toEqual({ok: true}));

function roomWith(...names: string[]): Room {
  const room = newRoom({code: 'KDRM', id: 'room-1', hostTokenHash: 'h', region: 'US', now});
  for (const n of names) expect(seatVoter(room, {id: n, nickname: n, seatTokenHash: n}, now)).toEqual({ok: true});
  return room;
}
const start = (room: Room) => expect(apply(room, HOST, cmd('startRound'), ctx())).toEqual({ok: true});

beforeEach(() => {
  now = T0;
});

describe('lobby', () => {
  it('only the host can start, and only with at least 2 voters', () => {
    const room = roomWith('sam');
    expect(apply(room, voter('sam'), cmd('startRound'), ctx())).toMatchObject({ok: false, error: 'UNAUTHORIZED'});
    expect(apply(room, HOST, cmd('startRound'), ctx())).toMatchObject({ok: false, error: 'NOT_ENOUGH_VOTERS'});
  });

  it('starting deals one shared deck (up to 15 cards) and a 90-second timer', () => {
    const room = roomWith('sam', 'ada');
    start(room);
    const round = room.rounds[0]!;
    expect(room.phase).toBe('voting');
    expect(round.deck).toHaveLength(10); // every eligible title in the test catalog
    expect(round.endsAt - round.startedAt).toBe(90_000);
  });

  it('applies the ground rules the host set before starting', () => {
    const room = roomWith('sam', 'ada');
    expect(apply(room, HOST, cmd('setRules', {rules: {maxRuntimeMin: 90}}), ctx())).toEqual({ok: true});
    start(room);
    expect(room.rounds[0]!.deck.map(c => c.titleId).sort()).toEqual(['demo:0004', 'demo:0008', 'demo:0010']);
  });

  it('voters can set a mood in the lobby; it shapes the deck', () => {
    const room = roomWith('sam', 'ada');
    expect(apply(room, voter('sam'), cmd('setMood', {chips: ['scary']}), ctx())).toEqual({ok: true});
    start(room);
    expect(room.rounds[0]!.deck[0]!.titleId).toBe('demo:0002'); // the horror title
  });

  it('caps the room at 8 voters', () => {
    const room = roomWith('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h');
    expect(seatVoter(room, {id: 'i', nickname: 'i', seatTokenHash: 'i'}, now)).toMatchObject({ok: false, error: 'ROOM_FULL'});
  });

  it('every change bumps the revision', () => {
    const room = roomWith('sam');
    const rev = room.rev;
    seatVoter(room, {id: 'ada', nickname: 'ada', seatTokenHash: 'ada'}, now);
    expect(room.rev).toBe(rev + 1);
  });
});

describe('voting', () => {
  let room: Room;
  beforeEach(() => {
    room = roomWith('sam', 'ada');
    start(room);
  });

  it('accepts votes card by card and rejects a vote for the wrong card', () => {
    expect(vote(room, 'sam', 'yes')).toEqual({ok: true});
    const wrong = apply(room, voter('sam'), cmd('vote', {roundNo: 1, cardIndex: 5, value: 'yes'}), ctx());
    expect(wrong).toMatchObject({ok: false, error: 'STALE_CARD'});
  });

  it('allows one veto and one super-yes per voter per round', () => {
    expect(vote(room, 'sam', 'veto')).toEqual({ok: true});
    expect(vote(room, 'sam', 'veto')).toMatchObject({ok: false, error: 'VETO_USED'});
    expect(vote(room, 'sam', 'superYes')).toEqual({ok: true});
    expect(vote(room, 'sam', 'superYes')).toMatchObject({ok: false, error: 'SUPER_YES_USED'});
  });

  it('undo removes only the last card and gives back a spent veto', () => {
    vote(room, 'sam', 'yes');
    vote(room, 'sam', 'veto');
    expect(apply(room, voter('sam'), cmd('undo', {roundNo: 1, cardIndex: 0}), ctx())).toMatchObject({ok: false, error: 'STALE_CARD'});
    expect(apply(room, voter('sam'), cmd('undo', {roundNo: 1, cardIndex: 1}), ctx())).toEqual({ok: true});
    expect(room.rounds[0]!.ballots['sam']!.votes).toEqual(['yes']);
    expect(vote(room, 'sam', 'veto')).toEqual({ok: true});
  });

  it('a repeated command id is acknowledged without being applied twice', () => {
    const c = cmd('vote', {roundNo: 1, cardIndex: 0, value: 'yes'});
    expect(apply(room, voter('sam'), c, ctx())).toEqual({ok: true});
    expect(apply(room, voter('sam'), c, ctx())).toEqual({ok: true});
    expect(room.rounds[0]!.ballots['sam']!.votes).toEqual(['yes']);
  });

  it('the host cannot vote', () => {
    expect(apply(room, HOST, cmd('vote', {roundNo: 1, cardIndex: 0, value: 'yes'}), ctx())).toMatchObject({ok: false, error: 'UNAUTHORIZED'});
  });
});

describe('ending a round', () => {
  it('ends as soon as every voter finishes, with exactly one pick', () => {
    const room = roomWith('sam', 'ada');
    start(room);
    const n = room.rounds[0]!.deck.length;
    voteAll(room, 'sam', ['yes', ...Array(n - 1).fill('no')]);
    expect(room.phase).toBe('voting');
    voteAll(room, 'ada', ['yes', ...Array(n - 1).fill('no')]);
    expect(room.phase).toBe('verdict');
    expect(room.rounds[0]!.endReason).toBe('allDone');
    expect(room.verdict?.winner).toBe(room.rounds[0]!.deck[0]!.titleId);
  });

  it('ends when the timer runs out; unreached cards count as No', () => {
    const room = roomWith('sam', 'ada');
    start(room);
    vote(room, 'sam', 'no');
    vote(room, 'sam', 'yes'); // card 2 is the only yes
    now += 89_000;
    expect(onTick(room, ctx())).toBe(false);
    now += 1_000;
    expect(onTick(room, ctx())).toBe(true);
    expect(room.rounds[0]!.endReason).toBe('timer');
    expect(room.verdict?.winner).toBe(room.rounds[0]!.deck[1]!.titleId);
  });

  it('a round ended by the tick bumps rev, so clients do not drop the verdict as stale', () => {
    const room = roomWith('sam', 'ada');
    start(room);
    const before = room.rev;
    now += 90_000;
    expect(onTick(room, ctx())).toBe(true);
    expect(room.rev).toBeGreaterThan(before);
  });

  it('the host can call it early', () => {
    const room = roomWith('sam', 'ada');
    start(room);
    vote(room, 'ada', 'yes');
    expect(apply(room, HOST, cmd('endRound'), ctx())).toEqual({ok: true});
    expect(room.rounds[0]!.endReason).toBe('host');
    expect(room.phase).toBe('verdict');
  });

  it('a voter who dropped more than 15 s ago does not block "everyone finished"', () => {
    const room = roomWith('sam', 'ada');
    start(room);
    setConnected(room, 'ada', false, now);
    now += 16_000;
    const n = room.rounds[0]!.deck.length;
    voteAll(room, 'sam', ['yes', ...Array(n - 1).fill('no')]);
    expect(room.phase).toBe('verdict');
  });

  it('a late joiner gets the same deck and their votes count', () => {
    const room = roomWith('sam', 'ada');
    start(room);
    expect(seatVoter(room, {id: 'kofi', nickname: 'kofi', seatTokenHash: 'kofi'}, now)).toEqual({ok: true});
    expect(room.voters.find(v => v.id === 'kofi')!.joinedRoundNo).toBe(1);
    vote(room, 'kofi', 'veto'); // vetoes card 1
    vote(room, 'sam', 'yes');
    vote(room, 'ada', 'yes');
    apply(room, HOST, cmd('endRound'), ctx());
    expect(room.verdict?.winner).not.toBe(room.rounds[0]!.deck[0]!.titleId);
  });

  it('writes a one-sentence reason of at most 140 characters that names the pick', () => {
    const room = roomWith('sam', 'ada');
    start(room);
    vote(room, 'sam', 'superYes');
    vote(room, 'ada', 'yes');
    apply(room, HOST, cmd('endRound'), ctx());
    const title = TEST_CATALOG.titles.find(t => t.id === room.verdict!.winner)!.title;
    expect(room.verdict!.reason).toContain(title);
    expect(room.verdict!.reason.length).toBeLessThanOrEqual(140);
    expect(room.verdict!.reasonSource).toBe('template');
  });
});

describe('sudden death', () => {
  function toSuddenDeath(): Room {
    const room = roomWith('sam', 'ada');
    start(room);
    vote(room, 'sam', 'no');
    apply(room, HOST, cmd('endRound'), ctx()); // nobody said yes
    return room;
  }

  it('starts when no surviving title got a yes: 5 new cards, 30 seconds, no vetoes', () => {
    const room = toSuddenDeath();
    expect(room.phase).toBe('suddenDeath');
    const sd = room.rounds[1]!;
    expect(sd).toMatchObject({kind: 'suddenDeath', parentNo: 1, allowVeto: false, allowSuperYes: false});
    expect(sd.endsAt - sd.startedAt).toBe(30_000);
    expect(sd.deck.length).toBeLessThanOrEqual(5);
    expect(vote(room, 'sam', 'veto')).toMatchObject({ok: false, error: 'NOT_ALLOWED_THIS_ROUND'});
  });

  it('always ends in a verdict, even if every vote is No', () => {
    const room = toSuddenDeath();
    now += 30_000;
    onTick(room, ctx());
    expect(room.phase).toBe('verdict');
    expect(room.verdict).toMatchObject({viaSuddenDeath: true, roundNo: 1});
  });
});

describe('after the verdict', () => {
  function decided(): Room {
    const room = roomWith('sam', 'ada');
    start(room);
    voteAll(room, 'sam', ['yes', 'yes', 'yes']);
    voteAll(room, 'ada', ['yes', 'yes', 'no']);
    apply(room, HOST, cmd('endRound'), ctx());
    return room;
  }

  it('Runner-up steps through the ranking, then reports there is no next one', () => {
    const room = decided();
    const ranking = room.verdict!.rankingIds;
    for (let i = 1; i < ranking.length; i++) expect(apply(room, HOST, cmd('runnerUp'), ctx())).toEqual({ok: true});
    expect(room.verdictCursor).toBe(ranking.length - 1);
    expect(apply(room, HOST, cmd('runnerUp'), ctx())).toMatchObject({ok: false, error: 'NO_RUNNER_UP'});
  });

  it('Rematch deals a fresh deck to the same voters without rejoining', () => {
    const room = decided();
    const first = new Set(room.rounds[0]!.deck.map(c => c.titleId));
    expect(apply(room, HOST, cmd('rematch'), ctx())).toEqual({ok: true});
    expect(room.phase).toBe('voting');
    expect(room.verdict).toBeUndefined();
    const second = room.rounds.at(-1)!;
    expect(second.no).toBe(2);
    // the test catalog has 10 eligible titles, all dealt in round 1, so the rematch reuses them
    expect(second.deck.length).toBeGreaterThan(0);
    expect(second.deck.every(c => first.has(c.titleId))).toBe(true);
  });

  it('Done closes the room', () => {
    const room = decided();
    expect(apply(room, HOST, cmd('closeRoom'), ctx())).toEqual({ok: true});
    expect(room.phase).toBe('closed');
    expect(seatVoter(room, {id: 'x', nickname: 'x', seatTokenHash: 'x'}, now)).toMatchObject({ok: false, error: 'WRONG_PHASE'});
  });
});

describe('with AI on (ADR-0008)', () => {
  const aiCtx = (): Ctx => ({...ctx(), aiReasons: true});
  const endWithYesOnFirst = (room: Room) => {
    start(room);
    const n = room.rounds[0]!.deck.length;
    for (const id of ['sam', 'ada'])
      for (let i = 0; i < n; i++) {
        const round = room.rounds.at(-1)!;
        apply(room, voter(id), cmd('vote', {roundNo: round.no, cardIndex: i, value: i === 0 ? 'yes' : 'no'}), aiCtx());
      }
  };

  it('a finished round waits in tally for the reason, with the template ready as a fallback', () => {
    const room = roomWith('sam', 'ada');
    endWithYesOnFirst(room);
    expect(room.phase).toBe('tally');
    expect(room.verdict?.reasonSource).toBe('template');
    expect(room.revealAt).toBe(now + REVEAL_DEADLINE_MS);
  });

  it('revealing with an AI reason shows it and bumps rev', () => {
    const room = roomWith('sam', 'ada');
    endWithYesOnFirst(room);
    const rev = room.rev;
    expect(revealVerdict(room, 'Two cozy votes, one clear winner.')).toBe(true);
    expect(room).toMatchObject({phase: 'verdict', verdict: {reason: 'Two cozy votes, one clear winner.', reasonSource: 'ai'}});
    expect(room.rev).toBeGreaterThan(rev);
    expect(room.revealAt).toBeUndefined();
    expect(revealVerdict(room, 'again')).toBe(false); // only once
  });

  it('the tick reveals the template reason if the AI is late', () => {
    const room = roomWith('sam', 'ada');
    endWithYesOnFirst(room);
    now += REVEAL_DEADLINE_MS - 1;
    expect(onTick(room, aiCtx())).toBe(false);
    now += 1;
    expect(onTick(room, aiCtx())).toBe(true);
    expect(room).toMatchObject({phase: 'verdict', verdict: {reasonSource: 'template'}});
  });

  it('deals a prepared AI shortlist when the moods and rules still match, topped up to 15', () => {
    const room = roomWith('sam', 'ada');
    const picks = [TEST_CATALOG.titles[3]!.id, TEST_CATALOG.titles[1]!.id];
    room.preparedDeck = {inputsHash: deckInputsKey(room), titleIds: picks, source: 'ai', builtAt: now};
    start(room);
    const round = room.rounds[0]!;
    expect(round.deckSource).toBe('ai');
    expect(round.deck.slice(0, 2).map(c => c.titleId)).toEqual(picks);
    expect(new Set(round.deck.map(c => c.titleId)).size).toBe(round.deck.length); // no repeats from the top-up
  });

  it('ignores a prepared shortlist built for different moods', () => {
    const room = roomWith('sam', 'ada');
    room.preparedDeck = {inputsHash: 'stale', titleIds: [TEST_CATALOG.titles[3]!.id], source: 'ai', builtAt: now};
    start(room);
    expect(room.rounds[0]!.deckSource).toBe('rules');
  });
});
