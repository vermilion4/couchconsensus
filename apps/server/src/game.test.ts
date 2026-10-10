// End to end over WebSockets: a TV and two phones play one round (US-1, US-3, US-4, US-7, US-9, SV-2, SV-3).
import {randomUUID} from 'node:crypto';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import type {FastifyInstance} from 'fastify';
import type {ServerMessage, TvView, VoterView} from '@couch/protocol';
import {buildApp} from './app';
import {loadConfig} from './config';

type Sock = Awaited<ReturnType<FastifyInstance['injectWS']>>;

/** Buffers every message so tests can wait for "the next view that satisfies X". */
function client(ws: Sock) {
  const inbox: ServerMessage[] = [];
  const waiters: {pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void}[] = [];
  ws.on('message', d => {
    const m = JSON.parse(String(d)) as ServerMessage;
    const w = waiters.findIndex(x => x.pred(m));
    if (w >= 0) waiters.splice(w, 1)[0]!.resolve(m);
    else inbox.push(m);
  });
  const waitFor = (pred: (m: ServerMessage) => boolean, label = 'message') =>
    new Promise<ServerMessage>((resolve, reject) => {
      const i = inbox.findIndex(pred);
      if (i >= 0) return resolve(inbox.splice(i, 1)[0]!);
      waiters.push({pred, resolve});
      setTimeout(() => reject(new Error(`timed out waiting for ${label}`)), 2000);
    });
  return {
    send: (m: object) => ws.send(JSON.stringify(m)),
    waitFor,
    view: <V extends TvView | VoterView>(pred: (v: V) => boolean = () => true, label = 'view') =>
      waitFor(m => m.type === 'view' && pred(m.view as V), label).then(m => (m as unknown as {view: V}).view),
    ack: (cmdId: string) => waitFor(m => (m.type === 'ack' || m.type === 'nack') && m.cmdId === cmdId, `ack ${cmdId}`),
    close: () => ws.terminate(),
  };
}

describe('a live round', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(loadConfig({PUBLIC_BASE_URL: 'https://couch.test', PHONE_DIST_DIR: '/nonexistent', LOG_LEVEL: 'silent'}));
    await app.ready();
  });
  afterAll(() => app.close());

  async function connect(hello: object) {
    const c = client(await app.injectWS('/ws'));
    c.send(hello);
    await c.waitFor(m => m.type === 'welcome', 'welcome');
    return c;
  }

  it('TV and phones stay in sync from lobby to verdict, and the TV never sees a vote', async () => {
    const {roomCode, hostToken} = (
      await app.inject({method: 'POST', url: '/api/rooms', payload: {clientInstallId: 'install-12345678'}})
    ).json();
    const tv = await connect({type: 'hello', roomCode, role: 'host', token: hostToken});
    await tv.view<TvView>(v => v.phase === 'lobby', 'lobby');

    const phones = [];
    for (const nickname of ['Sam', 'Ada']) {
      const seat = (await app.inject({method: 'POST', url: `/api/rooms/${roomCode}/seats`, payload: {nickname}})).json();
      phones.push(await connect({type: 'hello', roomCode, role: 'voter', token: seat.seatToken}));
    }
    // both names reach the TV, and Start unlocks (TV-3)
    await tv.view<TvView>(v => v.voters.length === 2 && v.canStart && v.voters.every(x => x.connected), 'two voters');

    const start = randomUUID();
    tv.send({type: 'startRound', cmdId: start});
    expect(await tv.ack(start)).toMatchObject({type: 'ack', ok: true});
    const deck = (await phones[0]!.view<VoterView>(v => v.phase === 'voting', 'voting')).round!.deck;
    await phones[1]!.view<VoterView>(v => v.phase === 'voting');

    // everyone says yes to card 0, no to the rest
    for (const phone of phones)
      for (let cardIndex = 0; cardIndex < deck.length; cardIndex++) {
        const cmdId = randomUUID();
        phone.send({type: 'vote', cmdId, roundNo: 1, cardIndex, value: cardIndex === 0 ? 'yes' : 'no'});
        expect(await phone.ack(cmdId)).toMatchObject({ok: true});
      }

    const verdict = await tv.view<TvView>(v => v.phase === 'verdict', 'verdict');
    expect(verdict.verdict?.title.id).toBe(deck[0]!.id);
    expect(verdict.verdict?.stats.unanimous).toBe(true);
    const result = await phones[0]!.view<VoterView>(v => v.phase === 'verdict', 'phone result');
    expect(result.result).toMatchObject({myVote: 'yes', title: {id: deck[0]!.id}});

    // a vote after the round is refused with a reason
    const late = randomUUID();
    phones[0]!.send({type: 'vote', cmdId: late, roundNo: 1, cardIndex: 0, value: 'yes'});
    expect(await phones[0]!.ack(late)).toMatchObject({type: 'nack', ok: false, error: 'ROUND_OVER'});

    for (const c of [tv, ...phones]) c.close();
  });

  it('a phone that reconnects gets its current place back (US-12)', async () => {
    const {roomCode, hostToken} = (
      await app.inject({method: 'POST', url: '/api/rooms', payload: {clientInstallId: 'install-12345678'}})
    ).json();
    const tv = await connect({type: 'hello', roomCode, role: 'host', token: hostToken});
    const seats = [];
    for (const nickname of ['Sam', 'Ada'])
      seats.push((await app.inject({method: 'POST', url: `/api/rooms/${roomCode}/seats`, payload: {nickname}})).json());
    const sam = await connect({type: 'hello', roomCode, role: 'voter', token: seats[0].seatToken});
    const start = randomUUID();
    tv.send({type: 'startRound', cmdId: start});
    await tv.ack(start);
    await sam.view<VoterView>(v => v.phase === 'voting');
    const v1 = randomUUID();
    sam.send({type: 'vote', cmdId: v1, roundNo: 1, cardIndex: 0, value: 'superYes'});
    await sam.ack(v1);
    sam.close();

    const again = await connect({type: 'hello', roomCode, role: 'voter', token: seats[0].seatToken});
    const view = await again.view<VoterView>(v => v.phase === 'voting', 'restored view');
    expect(view.me.ballot).toMatchObject({votes: ['superYes'], superYesAvailable: false});
    for (const c of [tv, again]) c.close();
  });
});
