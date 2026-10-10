// Holds live rooms, their open sockets and the timer loop; applies commands through the pure
// lifecycle and pushes a fresh audience projection to every client after each change (ADR-0003, ADR-0004).
// Single process: JavaScript runs one handler at a time, so commands for a room never interleave.
// DynamoDB persistence (ADR-0003) plugs in here next.
import {randomUUID} from 'node:crypto';
import {loadDemoCatalog, type CatalogFile} from '@couch/catalog';
import type {ClientCommand, ErrorCode, ServerMessage} from '@couch/protocol';
import {apply, newRoom, onTick, seatVoter, setConnected} from './lifecycle';
import type {Actor, Ctx, Result, Room} from './model';
import {projectTv, projectVoter} from './projections';
import {hashToken, newRoomCode, newToken, newVoterId, tokenMatches} from './tokens';

export type Auth = Actor;

export class RoomError extends Error {
  constructor(
    readonly code: Extract<ErrorCode, 'ROOM_NOT_FOUND' | 'ROOM_EXPIRED' | 'ROOM_FULL' | 'UNAUTHORIZED' | 'WRONG_PHASE'>,
    message: string,
  ) {
    super(message);
  }
}

/** Anything we can push a server message to (a WebSocket in production, a stub in tests). */
export interface Connection {
  send(message: ServerMessage): void;
}

interface Attached {
  auth: Auth;
  conn: Connection;
}

const TICK_MS = 500;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private sockets = new Map<string, Set<Attached>>();
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly catalog: CatalogFile = loadDemoCatalog(),
    private readonly now: () => number = Date.now,
  ) {}

  private ctx(): Ctx {
    return {now: this.now(), catalog: this.catalog};
  }

  /** Starts the timer loop (round deadlines, dropped voters, expiry). */
  start(): void {
    this.timer ??= setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  tick(): void {
    const ctx = this.ctx();
    for (const [code, room] of this.rooms) {
      if (room.expiresAt <= ctx.now) {
        this.rooms.delete(code);
        this.sockets.delete(code);
        continue;
      }
      if (onTick(room, ctx)) this.broadcast(room);
    }
  }

  create(region: string, joinUrl: (code: string) => string, clientInstallId?: string): {room: Room; hostToken: string} {
    let code = newRoomCode();
    while (this.rooms.has(code)) code = newRoomCode();
    const hostToken = newToken();
    const room = newRoom({
      code,
      id: randomUUID(),
      hostTokenHash: hashToken(hostToken),
      region,
      now: this.now(),
      joinUrl: joinUrl(code),
      ...(clientInstallId ? {clientInstallId} : {}),
    });
    this.rooms.set(code, room);
    return {room, hostToken};
  }

  get(code: string): Room {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', `No room ${code}`);
    if (room.expiresAt <= this.now()) {
      this.rooms.delete(code);
      throw new RoomError('ROOM_EXPIRED', `Room ${code} has expired`);
    }
    return room;
  }

  seat(code: string, nickname: string): {voterId: string; seatToken: string; nickname: string} {
    const room = this.get(code);
    const seatToken = newToken();
    const id = newVoterId();
    const result = seatVoter(room, {id, nickname, seatTokenHash: hashToken(seatToken)}, this.now());
    if (!result.ok) throw new RoomError(result.error as RoomError['code'], result.message);
    this.broadcast(room);
    return {voterId: id, seatToken, nickname: room.voters.find(v => v.id === id)!.nickname};
  }

  authenticate(code: string, role: 'host' | 'voter', token: string): Auth {
    const room = this.get(code);
    if (role === 'host' && tokenMatches(token, room.hostTokenHash)) return {role: 'host'};
    if (role === 'voter') {
      const voter = room.voters.find(v => !v.kicked && tokenMatches(token, v.seatTokenHash));
      if (voter) return {role: 'voter', voterId: voter.id};
    }
    throw new RoomError('UNAUTHORIZED', 'Invalid token for this room');
  }

  /** Registers a live connection, marks the voter connected and sends everyone a fresh view. */
  attach(code: string, auth: Auth, conn: Connection): () => void {
    const room = this.get(code);
    const entry: Attached = {auth, conn};
    let set = this.sockets.get(code);
    if (!set) this.sockets.set(code, (set = new Set()));
    set.add(entry);
    if (auth.role === 'voter') setConnected(room, auth.voterId, true, this.now());
    else room.hostLastSeenAt = this.now();
    this.broadcast(room);

    return () => {
      set.delete(entry);
      const stillThere = [...set].some(a => a.auth.role === 'voter' && auth.role === 'voter' && a.auth.voterId === auth.voterId);
      if (auth.role === 'voter' && !stillThere && this.rooms.has(code)) {
        setConnected(room, auth.voterId, false, this.now());
        this.broadcast(room);
      }
    };
  }

  dispatch(code: string, auth: Auth, cmd: ClientCommand): Result & {rev: number} {
    const room = this.get(code);
    const result = apply(room, auth, cmd, this.ctx());
    if (result.ok) this.broadcast(room);
    return {...result, rev: room.rev};
  }

  /** Activity from a client (e.g. ping) keeps a voter counted as present. */
  touch(code: string, auth: Auth): void {
    const room = this.rooms.get(code);
    if (!room) return;
    if (auth.role === 'voter') {
      const v = room.voters.find(x => x.id === auth.voterId);
      if (v) v.lastSeenAt = this.now();
    } else room.hostLastSeenAt = this.now();
  }

  view(room: Room, auth: Auth) {
    const ctx = this.ctx();
    return auth.role === 'host' ? projectTv(room, ctx) : projectVoter(room, auth.voterId, ctx);
  }

  private broadcast(room: Room): void {
    for (const {auth, conn} of this.sockets.get(room.code) ?? []) {
      // a kicked voter's socket just stops receiving updates
      if (auth.role === 'voter' && room.voters.find(v => v.id === auth.voterId)?.kicked) continue;
      conn.send({type: 'view', view: this.view(room, auth)});
    }
  }
}
