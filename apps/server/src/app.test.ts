import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import type {FastifyInstance} from 'fastify';
import type {ServerMessage} from '@couch/protocol';
import {buildApp} from './app';
import {loadConfig} from './config';

const nextMessage = (ws: {once: (ev: 'message', cb: (d: unknown) => void) => void}) =>
  new Promise<ServerMessage>(resolve => ws.once('message', d => resolve(JSON.parse(String(d)))));

describe('session service skeleton', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(loadConfig({PUBLIC_BASE_URL: 'https://couch.test', PHONE_DIST_DIR: '/nonexistent', LOG_LEVEL: 'silent'}));
    await app.ready();
  });
  afterAll(() => app.close());

  const createRoom = async () =>
    (await app.inject({method: 'POST', url: '/api/rooms', payload: {clientInstallId: 'install-12345678'}})).json();

  it('serves demo poster art', async () => {
    const res = await app.inject('/art/demo-0001.png');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
  });

  it('serves the TV sound effects as AAC', async () => {
    const res = await app.inject('/sounds/whistle.m4a');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('audio/mp4');
  });

  it('returns the current view over HTTP, the fallback when a WebSocket message is lost (ADR-0004)', async () => {
    const {roomCode, hostToken} = await createRoom();
    const tv = await app.inject({url: `/api/rooms/${roomCode}/view`, headers: {authorization: `Bearer ${hostToken}`}});
    expect(tv.statusCode).toBe(200);
    expect(tv.json()).toMatchObject({audience: 'tv', roomCode, phase: 'lobby'});

    const seat = (await app.inject({method: 'POST', url: `/api/rooms/${roomCode}/seats`, payload: {nickname: 'Ada'}})).json();
    const phone = await app.inject({url: `/api/rooms/${roomCode}/view`, headers: {authorization: `Bearer ${seat.seatToken}`}});
    expect(phone.json()).toMatchObject({audience: 'voter', me: {nickname: 'Ada'}});

    const nobody = await app.inject({url: `/api/rooms/${roomCode}/view`, headers: {authorization: `Bearer ${'x'.repeat(43)}`}});
    expect(nobody.statusCode).toBe(401);
  });

  it('reports health', async () => {
    const res = await app.inject('/healthz');
    expect(res.json()).toMatchObject({ok: true, protocol: 1});
  });

  it('creates a room with a 4-letter code, join URL and host token', async () => {
    const body = await createRoom();
    expect(body.roomCode).toMatch(/^[ABCDEFGHJKMNPQRTUWXY]{4}$/);
    expect(body.joinUrl).toBe(`https://couch.test/r/${body.roomCode}`);
    expect(body.hostToken.length).toBeGreaterThanOrEqual(32);
    expect(body.region).toBe('US');
  });

  it('derives the join URL from the viewer host when no public base URL is configured', async () => {
    const prod = await buildApp(loadConfig({NODE_ENV: 'production', PHONE_DIST_DIR: '/nonexistent', LOG_LEVEL: 'silent'}));
    const res = await prod.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: {host: 'd1234.cloudfront.net', 'cloudfront-forwarded-proto': 'https'},
      payload: {clientInstallId: 'install-12345678'},
    });
    expect(res.json().joinUrl).toMatch(/^https:\/\/d1234\.cloudfront\.net\/r\/[A-Z]{4}$/);
    await prod.close();
  });

  it('uses the CloudFront viewer country as the region', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: {'cloudfront-viewer-country': 'GB'},
      payload: {clientInstallId: 'install-12345678'},
    });
    expect(res.json().region).toBe('GB');
  });

  it('seats voters with sanitised, de-duplicated nicknames', async () => {
    const {roomCode} = await createRoom();
    const seat = (nickname: string) =>
      app.inject({method: 'POST', url: `/api/rooms/${roomCode}/seats`, payload: {nickname}}).then(r => r.json());
    expect((await seat(' Sam ')).nickname).toBe('Sam');
    expect((await seat('sam')).nickname).toBe('sam 2');
  });

  it('rejects a 13-character nickname and an unknown room', async () => {
    const {roomCode} = await createRoom();
    const long = await app.inject({method: 'POST', url: `/api/rooms/${roomCode}/seats`, payload: {nickname: 'ThirteenChars'}});
    expect(long.statusCode).toBe(400);
    const missing = await app.inject({method: 'POST', url: '/api/rooms/KDRM/seats', payload: {nickname: 'Ada'}});
    expect([404, 400]).toContain(missing.statusCode);
  });

  it('caps a room at 8 voters', async () => {
    const {roomCode} = await createRoom();
    for (let i = 0; i < 8; i++)
      await app.inject({method: 'POST', url: `/api/rooms/${roomCode}/seats`, payload: {nickname: `P${i}`}});
    const ninth = await app.inject({method: 'POST', url: `/api/rooms/${roomCode}/seats`, payload: {nickname: 'P9'}});
    expect(ninth.statusCode).toBe(409);
  });

  it('welcomes a host and a voter over WebSocket', async () => {
    const {roomCode, hostToken} = await createRoom();
    const {seatToken, voterId} = (
      await app.inject({method: 'POST', url: `/api/rooms/${roomCode}/seats`, payload: {nickname: 'Ada'}})
    ).json();

    const tv = await app.injectWS('/ws');
    const tvReply = nextMessage(tv);
    tv.send(JSON.stringify({type: 'hello', roomCode, role: 'host', token: hostToken}));
    expect(await tvReply).toEqual({type: 'welcome', role: 'host', protocol: 1});

    const phone = await app.injectWS('/ws');
    const phoneReply = nextMessage(phone);
    phone.send(JSON.stringify({type: 'hello', roomCode, role: 'voter', token: seatToken}));
    expect(await phoneReply).toEqual({type: 'welcome', role: 'voter', voterId, protocol: 1});

    tv.terminate();
    phone.terminate();
  });

  it('rejects a wrong token with a fatal error', async () => {
    const {roomCode} = await createRoom();
    const ws = await app.injectWS('/ws');
    const reply = nextMessage(ws);
    ws.send(JSON.stringify({type: 'hello', roomCode, role: 'host', token: 'x'.repeat(43)}));
    expect(await reply).toMatchObject({type: 'error', error: 'UNAUTHORIZED', fatal: true});
    ws.terminate();
  });

  it('answers unreadable messages without dropping the socket', async () => {
    const ws = await app.injectWS('/ws');
    const reply = nextMessage(ws);
    ws.send('not json');
    expect(await reply).toMatchObject({type: 'error', error: 'BAD_MESSAGE', fatal: false});
    ws.terminate();
  });
});
