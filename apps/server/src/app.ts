// Fastify app: REST, WebSocket gateway and the phone page (ARCHITECTURE §5.3, DATA_MODEL §5.1).
import {existsSync} from 'node:fs';
import Fastify, {type FastifyInstance} from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import {
  ClientMessage,
  CloseCode,
  CreateRoomRequest,
  JoinRoomRequest,
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  RoomCode,
  type ServerMessage,
} from '@couch/protocol';
import type {Config} from './config';
import {loadDemoCatalog} from '@couch/catalog';
import {BedrockAi, bedrockClient} from './ai/bedrock';
import {RoomError, RoomManager, type Auth} from './rooms/room-manager';

const HTTP_STATUS: Record<RoomError['code'], number> = {
  ROOM_NOT_FOUND: 404,
  ROOM_EXPIRED: 410,
  ROOM_FULL: 409,
  UNAUTHORIZED: 401,
  WRONG_PHASE: 409,
};

export async function buildApp(config: Config, roomManager?: RoomManager): Promise<FastifyInstance> {
  const app = Fastify({logger: {level: config.logLevel}, bodyLimit: MAX_MESSAGE_BYTES});
  const rooms =
    roomManager ??
    new RoomManager(loadDemoCatalog(), Date.now, {
      ...(config.aiMode === 'on' ? {ai: new BedrockAi(bedrockClient(config.awsRegion), config.bedrockModelId)} : {}),
      // Every Bedrock outcome is logged: source, latency and why a fallback was used (AWS write-up).
      onAiEvent: event => app.log.info({ai: event}, `ai ${event.task}: ${event.outcome}`),
    });
  rooms.start();
  app.addHook('onClose', async () => rooms.stop());

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof RoomError) return reply.code(HTTP_STATUS[err.code]).send({error: err.code, message: err.message});
    const e = err as Error & {validation?: unknown};
    if (e.validation || e.name === 'ZodError') return reply.code(400).send({error: 'BAD_MESSAGE', message: e.message});
    app.log.error(err);
    return reply.code(500).send({error: 'INTERNAL', message: 'Something went wrong'});
  });

  app.get('/healthz', async () => ({ok: true, protocol: PROTOCOL_VERSION, serverNow: Date.now()}));

  // ---------- REST ----------

  app.post('/api/rooms', async req => {
    const {clientInstallId} = CreateRoomRequest.parse(req.body);
    // CloudFront adds the viewer's country (ADR-0009); local dev falls back to the default.
    const country = String(req.headers['cloudfront-viewer-country'] ?? config.defaultRegion);
    const base = config.publicBaseUrl ?? requestOrigin(req.headers);
    const {room, hostToken} = rooms.create(country, code => `${base}/r/${code}`, clientInstallId);
    req.log.info({roomCode: room.code, region: room.region}, 'room created');
    return {roomCode: room.code, joinUrl: room.joinUrl, hostToken, region: room.region};
  });

  app.post<{Params: {code: string}}>('/api/rooms/:code/seats', async req => {
    const code = RoomCode.parse(req.params.code.toUpperCase());
    const {nickname} = JoinRoomRequest.parse(req.body);
    const seat = rooms.seat(code, nickname);
    req.log.info({roomCode: code, voterId: seat.voterId}, 'voter seated');
    return seat;
  });

  // ---------- WebSocket ----------

  await app.register(fastifyWebsocket, {options: {maxPayload: MAX_MESSAGE_BYTES}});

  app.get('/ws', {websocket: true}, socket => {
    let auth: Auth | undefined;
    let roomCode: string | undefined;
    let detach: (() => void) | undefined;
    const send = (m: ServerMessage) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(m));
    };
    socket.on('close', () => detach?.());

    socket.on('message', raw => {
      let parsed;
      try {
        parsed = ClientMessage.safeParse(JSON.parse(String(raw)));
      } catch {
        parsed = undefined;
      }
      if (!parsed?.success) return send({type: 'error', error: 'BAD_MESSAGE', message: 'Unreadable message', fatal: false});
      const msg = parsed.data;

      if (msg.type === 'ping') {
        if (auth && roomCode) rooms.touch(roomCode, auth);
        return send({type: 'pong', t: msg.t, serverNow: Date.now()});
      }

      if (msg.type === 'hello') {
        try {
          auth = rooms.authenticate(msg.roomCode, msg.role, msg.token);
          roomCode = msg.roomCode;
          app.log.info({roomCode, role: auth.role}, 'socket authenticated');
          send({
            type: 'welcome',
            role: auth.role,
            ...(auth.role === 'voter' ? {voterId: auth.voterId} : {}),
            protocol: PROTOCOL_VERSION,
          });
          detach?.();
          detach = rooms.attach(roomCode, auth, {send}); // sends the first view
          return;
        } catch (e) {
          const code = e instanceof RoomError ? e.code : 'INTERNAL';
          app.log.warn({roomCode: msg.roomCode, role: msg.role, code}, 'socket rejected');
          send({type: 'error', error: code, message: (e as Error).message, fatal: true});
          return socket.close(code === 'UNAUTHORIZED' ? CloseCode.unauthorized : CloseCode.roomGone);
        }
      }

      if (!auth || !roomCode) return send({type: 'error', error: 'UNAUTHORIZED', message: 'Send hello first', fatal: false});
      try {
        const r = rooms.dispatch(roomCode, auth, msg);
        return send(
          r.ok
            ? {type: 'ack', cmdId: msg.cmdId, ok: true, rev: r.rev}
            : {type: 'nack', cmdId: msg.cmdId, ok: false, error: r.error, message: r.message},
        );
      } catch (e) {
        const code = e instanceof RoomError ? e.code : 'INTERNAL';
        if (code === 'INTERNAL') app.log.error(e);
        return send({type: 'nack', cmdId: msg.cmdId, ok: false, error: code, message: (e as Error).message});
      }
    });
  });

  // ---------- demo poster art (original, SV-6) ----------

  if (existsSync(config.artDir)) {
    await app.register(fastifyStatic, {
      root: config.artDir,
      prefix: '/art/',
      decorateReply: false,
      maxAge: '7d',
      immutable: true,
    });
  } else {
    app.log.warn(`Poster art not found (${config.artDir}); run "node packages/catalog/scripts/build-posters.mjs"`);
  }

  // ---------- phone page ----------

  if (existsSync(config.phoneDistDir)) {
    // wildcard: files are looked up per request, so a rebuilt phone page is served without a restart
    await app.register(fastifyStatic, {root: config.phoneDistDir, prefix: '/', wildcard: true});
    app.get('/r/:code', (_req, reply) => reply.sendFile('index.html'));
  } else {
    app.log.warn(`Phone page not built (${config.phoneDistDir}); run "pnpm --filter @couch/phone build", or use the Vite dev server`);
  }

  return app;
}

/** Public origin as the viewer saw it. CloudFront forwards the viewer Host and CloudFront-Forwarded-Proto. */
function requestOrigin(headers: Record<string, string | string[] | undefined>): string {
  const first = (h: string | string[] | undefined) => (Array.isArray(h) ? h[0] : h)?.split(',')[0]?.trim();
  const proto = first(headers['cloudfront-forwarded-proto']) ?? first(headers['x-forwarded-proto']) ?? 'https';
  return `${proto}://${first(headers.host) ?? 'localhost'}`;
}
