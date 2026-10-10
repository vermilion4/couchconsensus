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
import {RoomError, RoomManager, type Auth} from './rooms/room-manager';

const HTTP_STATUS: Record<RoomError['code'], number> = {
  ROOM_NOT_FOUND: 404,
  ROOM_EXPIRED: 410,
  ROOM_FULL: 409,
  UNAUTHORIZED: 401,
};

export async function buildApp(config: Config, rooms = new RoomManager()): Promise<FastifyInstance> {
  const app = Fastify({logger: {level: config.logLevel}, bodyLimit: MAX_MESSAGE_BYTES});

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
    CreateRoomRequest.parse(req.body);
    // CloudFront adds the viewer's country (ADR-0009); local dev falls back to the default.
    const country = String(req.headers['cloudfront-viewer-country'] ?? config.defaultRegion);
    const {room, hostToken} = rooms.create(country);
    req.log.info({roomCode: room.code, region: room.region}, 'room created');
    return {
      roomCode: room.code,
      joinUrl: `${config.publicBaseUrl}/r/${room.code}`,
      hostToken,
      region: room.region,
    };
  });

  app.post<{Params: {code: string}}>('/api/rooms/:code/seats', async req => {
    const code = RoomCode.parse(req.params.code.toUpperCase());
    const {nickname} = JoinRoomRequest.parse(req.body);
    const {voter, seatToken} = rooms.seat(code, nickname);
    req.log.info({roomCode: code, voterId: voter.id}, 'voter seated');
    return {voterId: voter.id, seatToken, nickname: voter.nickname};
  });

  // ---------- WebSocket ----------

  await app.register(fastifyWebsocket, {options: {maxPayload: MAX_MESSAGE_BYTES}});

  app.get('/ws', {websocket: true}, socket => {
    let auth: Auth | undefined;
    let roomCode: string | undefined;
    const send = (m: ServerMessage) => socket.send(JSON.stringify(m));

    socket.on('message', raw => {
      let parsed;
      try {
        parsed = ClientMessage.safeParse(JSON.parse(String(raw)));
      } catch {
        parsed = undefined;
      }
      if (!parsed?.success) return send({type: 'error', error: 'BAD_MESSAGE', message: 'Unreadable message', fatal: false});
      const msg = parsed.data;

      if (msg.type === 'ping') return send({type: 'pong', t: msg.t, serverNow: Date.now()});

      if (msg.type === 'hello') {
        try {
          auth = rooms.authenticate(msg.roomCode, msg.role, msg.token);
          roomCode = msg.roomCode;
          app.log.info({roomCode, role: auth.role}, 'socket authenticated');
          return send({
            type: 'welcome',
            role: auth.role,
            ...(auth.role === 'voter' ? {voterId: auth.voterId} : {}),
            protocol: PROTOCOL_VERSION,
          });
        } catch (e) {
          const code = e instanceof RoomError ? e.code : 'INTERNAL';
          app.log.warn({roomCode: msg.roomCode, role: msg.role, code}, 'socket rejected');
          send({type: 'error', error: code, message: (e as Error).message, fatal: true});
          return socket.close(code === 'UNAUTHORIZED' ? CloseCode.unauthorized : CloseCode.roomGone);
        }
      }

      if (!auth || !roomCode) return send({type: 'error', error: 'UNAUTHORIZED', message: 'Send hello first', fatal: false});
      // Commands are routed to the room's serial queue in the next step.
      return send({type: 'nack', cmdId: msg.cmdId, ok: false, error: 'WRONG_PHASE', message: 'Not implemented yet'});
    });
  });

  // ---------- phone page ----------

  if (existsSync(config.phoneDistDir)) {
    await app.register(fastifyStatic, {root: config.phoneDistDir, prefix: '/', wildcard: false});
    app.get('/r/:code', (_req, reply) => reply.sendFile('index.html'));
  } else {
    app.log.warn(`Phone page not built (${config.phoneDistDir}); run "pnpm --filter @couch/phone build", or use the Vite dev server`);
  }

  return app;
}
