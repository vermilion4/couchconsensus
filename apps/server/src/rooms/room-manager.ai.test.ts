import {randomUUID} from 'node:crypto';
import {describe, expect, it, vi} from 'vitest';
import type {ClientCommand, ServerMessage, TvView, VoteValue} from '@couch/protocol';
import type {AiPort, DeckAsk} from '../ai/port';
import {RoomManager, type AiEvent} from './room-manager';
import {TEST_CATALOG} from './test-catalog';

const cmd = (c: Record<string, unknown>) => ({cmdId: randomUUID(), ...c}) as ClientCommand;
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

/** A room with two voters and a TV socket that records every view. */
function setup(ai: Partial<AiPort> | undefined, opts: {reasonBudgetMs?: number} = {}) {
  const events: AiEvent[] = [];
  const rooms = new RoomManager(TEST_CATALOG, Date.now, {
    ...(ai ? {ai: {deck: async () => Promise.reject(new Error('unused')), reason: async () => Promise.reject(new Error('unused')), ...ai}} : {}),
    deckDebounceMs: 0,
    deckBudgetMs: 200,
    reasonBudgetMs: opts.reasonBudgetMs ?? 200,
    onAiEvent: e => events.push(e),
  });
  const {room} = rooms.create('US', code => `http://x/r/${code}`);
  const tv: TvView[] = [];
  rooms.attach(room.code, {role: 'host'}, {send: (m: ServerMessage) => m.type === 'view' && m.view.audience === 'tv' && tv.push(m.view)});
  const sam = rooms.seat(room.code, 'Sam').voterId;
  const ada = rooms.seat(room.code, 'Ada').voterId;
  const host = (c: Record<string, unknown>) => rooms.dispatch(room.code, {role: 'host'}, cmd(c));
  const vote = (voterId: string, cardIndex: number, value: VoteValue) =>
    rooms.dispatch(room.code, {role: 'voter', voterId}, cmd({type: 'vote', roundNo: room.rounds.at(-1)!.no, cardIndex, value}));
  const mood = (voterId: string, chips: string[]) => rooms.dispatch(room.code, {role: 'voter', voterId}, cmd({type: 'setMood', chips}));
  return {rooms, room, tv, sam, ada, host, vote, mood, events};
}

/** Starts a round, both say yes to card 0, and the host calls it. */
function playRound(s: ReturnType<typeof setup>) {
  expect(s.host({type: 'startRound'}).ok).toBe(true);
  s.vote(s.sam, 0, 'yes');
  s.vote(s.ada, 0, 'yes');
  expect(s.host({type: 'endRound'}).ok).toBe(true);
}

describe('RoomManager with AI-2 (verdict reason)', () => {
  it('holds the verdict in tally, then shows the AI reason', async () => {
    const s = setup({reason: async ask => `Everyone said yes, and ${ask.winner.title} won the room over.`});
    playRound(s);
    expect(s.room.phase).toBe('tally');
    await vi.waitFor(() => expect(s.room.phase).toBe('verdict'));
    expect(s.room.verdict?.reasonSource).toBe('ai');
    expect(s.tv.at(-1)?.verdict?.reason).toMatch(/won the room over/);
    expect(s.events).toContainEqual(expect.objectContaining({task: 'reason', outcome: 'ai'}));
  });

  it('shows the template at once when the AI answer breaks the rules', async () => {
    const s = setup({reason: async () => 'Great pick. Truly great.'}); // two sentences
    playRound(s);
    await vi.waitFor(() => expect(s.room.phase).toBe('verdict'));
    expect(s.room.verdict?.reasonSource).toBe('template');
    expect(s.events).toContainEqual(expect.objectContaining({task: 'reason', outcome: 'fallback', error: 'rejected by checks'}));
  });

  it('shows the template when Bedrock is slower than the budget or refuses', async () => {
    const slow = setup({reason: () => new Promise(r => setTimeout(() => r('Too late.'), 1_000))}, {reasonBudgetMs: 30});
    playRound(slow);
    await vi.waitFor(() => expect(slow.room.phase).toBe('verdict'));
    expect(slow.room.verdict?.reasonSource).toBe('template');
    expect(slow.events).toContainEqual(expect.objectContaining({outcome: 'fallback', error: 'timeout'}));

    const blocked = setup({reason: async () => Promise.reject(new Error('Operation not allowed'))});
    playRound(blocked);
    await vi.waitFor(() => expect(blocked.room.phase).toBe('verdict'));
    expect(blocked.events).toContainEqual(expect.objectContaining({outcome: 'fallback', error: 'Operation not allowed'}));
  });

  it('without AI the verdict shows straight away', () => {
    const s = setup(undefined);
    playRound(s);
    expect(s.room.phase).toBe('verdict');
  });
});

describe('RoomManager with AI-1 (mood → deck)', () => {
  it('builds a shortlist from the moods in the lobby and deals it on Start', async () => {
    const asks: DeckAsk[] = [];
    const picks = [TEST_CATALOG.titles[4]!.id, TEST_CATALOG.titles[2]!.id];
    const s = setup({
      deck: async ask => {
        asks.push(ask);
        return {filters: {genresBoost: [], genresAvoid: [], tones: []}, shortlist: [...picks, 'demo:9999']};
      },
    });
    s.mood(s.sam, ['funny']);
    await vi.waitFor(() => expect(s.room.preparedDeck?.titleIds).toEqual(picks));
    expect(asks).toHaveLength(1);
    expect(JSON.stringify(asks[0])).not.toMatch(/Sam|Ada/);

    s.host({type: 'startRound'});
    expect(s.room.rounds[0]!.deckSource).toBe('ai');
    expect(s.room.rounds[0]!.deck.slice(0, 2).map(c => c.titleId)).toEqual(picks);
  });

  it('drops a shortlist whose moods changed while Bedrock was answering', async () => {
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const s = setup({
      deck: async () => {
        await gate;
        return {filters: {genresBoost: [], genresAvoid: [], tones: []}, shortlist: [TEST_CATALOG.titles[4]!.id]};
      },
    });
    s.mood(s.sam, ['funny']);
    await tick(5);
    s.mood(s.ada, ['scary']); // the room changed its mind
    release();
    await tick(20);
    // the first answer is stale; the second build (for both moods) is the only one that may land
    expect(s.room.preparedDeck === undefined || s.room.preparedDeck.inputsHash.includes('scary')).toBe(true);
  });

  it('asks nothing when nobody gave a mood', async () => {
    const deck = vi.fn();
    const s = setup({deck});
    s.mood(s.sam, []);
    await tick(10);
    expect(deck).not.toHaveBeenCalled();
  });
});
