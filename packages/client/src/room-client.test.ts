import {beforeEach, describe, expect, it} from 'vitest';
import type {TvView, VoterView} from '@couch/protocol';
import {RoomClient, uuid, type SocketLike} from './room-client';

/** In-memory WebSocket stand-in. */
class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  sent: unknown[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: {data: string}) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  // test helpers
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(m: object) {
    this.onmessage?.({data: JSON.stringify(m)});
  }
}

const view = (rev: number, extra: Partial<VoterView> = {}): VoterView => ({
  audience: 'voter',
  rev,
  serverNow: 1_000_000 + rev,
  roomCode: 'KDRM',
  phase: 'lobby',
  me: {id: 'v_aaaaaaaa', nickname: 'Ada'},
  roomSize: 2,
  ...extra,
});

let client: RoomClient;
const sock = () => FakeSocket.all.at(-1)!;

beforeEach(() => {
  FakeSocket.all = [];
  client = new RoomClient({
    url: 'ws://x/ws',
    roomCode: 'KDRM',
    role: 'voter',
    token: 't'.repeat(43),
    socket: url => new FakeSocket(url),
    now: () => 1_000_500,
    schedule: fn => fn(), // reconnect immediately in tests
  });
  client.start();
});

describe('RoomClient', () => {
  it('says hello as a voter when the socket opens', () => {
    sock().open();
    expect(sock().sent[0]).toMatchObject({type: 'hello', roomCode: 'KDRM', role: 'voter'});
  });

  it('keeps the newest view and ignores out-of-order older ones', () => {
    sock().open();
    sock().receive({type: 'view', view: view(5)});
    sock().receive({type: 'view', view: view(4)});
    expect(client.view?.rev).toBe(5);
  });

  it('estimates the server clock offset from each view', () => {
    sock().open();
    sock().receive({type: 'view', view: view(10)}); // serverNow 1_000_010, local now 1_000_500
    expect(client.clockOffset).toBe(-490);
  });

  it('resolves a command when its ack arrives, and reports a nack as an error', async () => {
    sock().open();
    sock().receive({type: 'welcome', role: 'voter', protocol: 1});
    const ok = client.send({type: 'setMood', chips: ['funny']});
    const sentId = (sock().sent.at(-1) as {cmdId: string}).cmdId;
    sock().receive({type: 'ack', cmdId: sentId, ok: true, rev: 3});
    await expect(ok).resolves.toEqual({ok: true});

    const bad = client.send({type: 'vote', roundNo: 1, cardIndex: 0, value: 'veto'});
    const badId = (sock().sent.at(-1) as {cmdId: string}).cmdId;
    sock().receive({type: 'nack', cmdId: badId, ok: false, error: 'VETO_USED', message: 'You already used your veto'});
    await expect(bad).resolves.toEqual({ok: false, error: 'VETO_USED', message: 'You already used your veto'});
  });

  it('reconnects after a drop and resends commands that were never acknowledged', () => {
    sock().open();
    sock().receive({type: 'welcome', role: 'voter', protocol: 1});
    void client.send({type: 'vote', roundNo: 1, cardIndex: 0, value: 'yes'});
    const first = sock();
    const cmdId = (first.sent.at(-1) as {cmdId: string}).cmdId;
    first.close();
    expect(client.state).toBe('reconnecting');

    const second = sock();
    expect(second).not.toBe(first);
    second.open();
    second.receive({type: 'welcome', role: 'voter', protocol: 1});
    expect(second.sent.map(m => (m as {type: string}).type)).toEqual(['hello', 'vote']);
    expect((second.sent[1] as {cmdId: string}).cmdId).toBe(cmdId); // same id: the server applies it once
  });

  it('stops for good when the server rejects the seat', () => {
    sock().open();
    sock().receive({type: 'error', error: 'ROOM_EXPIRED', message: 'Room KDRM has expired', fatal: true});
    sock().close();
    expect(client.state).toBe('rejected');
    expect(client.rejection).toBe('ROOM_EXPIRED');
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('as the host, says hello with the host role and keeps only TV views', () => {
    const host = new RoomClient({
      url: 'ws://x/ws',
      roomCode: 'KDRM',
      role: 'host',
      token: 'h'.repeat(43),
      socket: url => new FakeSocket(url),
      now: () => 1_000_500,
    });
    host.start();
    sock().open();
    expect(sock().sent[0]).toMatchObject({type: 'hello', role: 'host', token: 'h'.repeat(43)});
    sock().receive({type: 'view', view: view(7)}); // a voter view never belongs on the TV
    expect(host.view).toBeUndefined();
    sock().receive({type: 'view', view: tvView(8)});
    expect(host.view?.audience).toBe('tv');
  });
});

describe('RoomClient self-heal', () => {
  it('reconnects for a fresh view when an ack says the room moved on but no newer view arrived', () => {
    const later: (() => void)[] = [];
    const c = new RoomClient({
      url: 'ws://x/ws',
      roomCode: 'KDRM',
      role: 'voter',
      token: 't'.repeat(43),
      socket: url => new FakeSocket(url),
      now: () => 1_000_500,
      schedule: fn => void later.push(fn),
    });
    FakeSocket.all = [];
    c.start();
    sock().open();
    sock().receive({type: 'welcome', role: 'voter', protocol: 1});
    sock().receive({type: 'view', view: view(5)});
    void c.send({type: 'setMood', chips: ['funny']});
    const first = sock();
    first.receive({type: 'ack', cmdId: (first.sent.at(-1) as {cmdId: string}).cmdId, ok: true, rev: 7});

    later.shift()!(); // the check: still on rev 5
    expect(FakeSocket.all).toHaveLength(1);
    expect(first.readyState).toBe(3); // closed on purpose
    later.shift()!(); // the reconnect
    expect(FakeSocket.all).toHaveLength(2);
  });

  it('leaves the socket alone when the newer view did arrive', () => {
    const later: (() => void)[] = [];
    const c = new RoomClient({
      url: 'ws://x/ws',
      roomCode: 'KDRM',
      role: 'voter',
      token: 't'.repeat(43),
      socket: url => new FakeSocket(url),
      now: () => 1_000_500,
      schedule: fn => void later.push(fn),
    });
    FakeSocket.all = [];
    c.start();
    sock().open();
    sock().receive({type: 'welcome', role: 'voter', protocol: 1});
    sock().receive({type: 'view', view: view(5)});
    void c.send({type: 'setMood', chips: ['funny']});
    sock().receive({type: 'ack', cmdId: (sock().sent.at(-1) as {cmdId: string}).cmdId, ok: true, rev: 7});
    sock().receive({type: 'view', view: view(7)});
    later.shift()!();
    expect(sock().readyState).toBe(1);
    expect(later).toHaveLength(0);
  });
});

describe('uuid', () => {
  it('makes a v4 UUID even without Web Crypto (the TV engine)', () => {
    const saved = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', {value: undefined, configurable: true});
    try {
      expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {value: saved, configurable: true});
    }
  });
});

function tvView(rev: number): TvView {
  return {
    audience: 'tv',
    rev,
    serverNow: 1_000_000 + rev,
    roomCode: 'KDRM',
    joinUrl: 'http://x/r/KDRM',
    phase: 'lobby',
    rules: {services: [], maxRuntimeMin: null, kind: 'film', includeAdult: false, deckSize: 15, roundSeconds: 90, region: 'ZZ', availableServices: []},
    voters: [],
    canStart: false,
  };
}
