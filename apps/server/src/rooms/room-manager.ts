// Holds live rooms, their open sockets and the timer loop; applies commands through the pure
// lifecycle and pushes a fresh audience projection to every client after each change (ADR-0003, ADR-0004).
// Single process: JavaScript runs one handler at a time, so commands for a room never interleave.
// It also runs the two Bedrock tasks (ADR-0008) off the request path: AI-1 prepares a shortlist while
// the room sits in the lobby, AI-2 writes the verdict reason during tally. Both always have a fallback.
// DynamoDB persistence (ADR-0003) plugs in here next.
import {randomUUID} from 'node:crypto';
import {loadDemoCatalog, type CatalogFile} from '@couch/catalog';
import type {ClientCommand, ErrorCode, ServerMessage} from '@couch/protocol';
import {acceptReason, acceptShortlist, withBudget} from '../ai/guard';
import type {AiPort} from '../ai/port';
import {deckAsk, reasonAsk} from '../ai/requests';
import {deckInputsKey} from './deck';
import {apply, newRoom, onTick, revealVerdict, seatVoter, setConnected} from './lifecycle';
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

/** One Bedrock call's outcome, for the logs and the AWS write-up. */
export interface AiEvent {
  task: 'deck' | 'reason';
  outcome: 'ai' | 'fallback';
  ms: number;
  error?: string;
}

export interface AiOptions {
  /** Unset = AI off: rule-based decks and template reasons only (AI_MODE=off). */
  ai?: AiPort;
  /** Wait this long after the last mood or rules change before building a shortlist. */
  deckDebounceMs?: number;
  deckBudgetMs?: number;
  /** Must stay under REVEAL_DEADLINE_MS so the verdict lands within 3 s. */
  reasonBudgetMs?: number;
  onAiEvent?: (event: AiEvent) => void;
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private sockets = new Map<string, Set<Attached>>();
  private timer: NodeJS.Timeout | undefined;
  private readonly ai: AiPort | undefined;
  private readonly aiOpts: Required<Omit<AiOptions, 'ai' | 'onAiEvent'>> & Pick<AiOptions, 'onAiEvent'>;
  /** Per room: the deck inputs a shortlist is scheduled or being built for, and its debounce timer. */
  private deckBuilds = new Map<string, {key: string; timer?: NodeJS.Timeout}>();
  /** Verdicts (code:decidedAt) whose reason is being written. */
  private reasonsInFlight = new Set<string>();

  constructor(
    private readonly catalog: CatalogFile = loadDemoCatalog(),
    private readonly now: () => number = Date.now,
    opts: AiOptions = {},
  ) {
    this.ai = opts.ai;
    this.aiOpts = {
      deckDebounceMs: opts.deckDebounceMs ?? 1_000,
      deckBudgetMs: opts.deckBudgetMs ?? 3_000,
      reasonBudgetMs: opts.reasonBudgetMs ?? 2_500,
      ...(opts.onAiEvent ? {onAiEvent: opts.onAiEvent} : {}),
    };
  }

  private ctx(): Ctx {
    return {now: this.now(), catalog: this.catalog, ...(this.ai ? {aiReasons: true} : {})};
  }

  /** Starts the timer loop (round deadlines, dropped voters, expiry). */
  start(): void {
    this.timer ??= setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
    for (const b of this.deckBuilds.values()) clearTimeout(b.timer);
    this.deckBuilds.clear();
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
    this.afterChange(room);
  }

  /** Every visible change passes through here; start whatever AI work the new state calls for. */
  private afterChange(room: Room): void {
    if (!this.ai) return;
    if (room.phase === 'lobby') this.scheduleDeck(room);
    else if (room.phase === 'tally') void this.writeReason(room);
  }

  private scheduleDeck(room: Room): void {
    const key = deckInputsKey(room);
    const current = this.deckBuilds.get(room.code);
    if (room.preparedDeck?.inputsHash === key || current?.key === key) return;
    clearTimeout(current?.timer);
    const build = {key, timer: setTimeout(() => void this.buildDeck(room.code, key), this.aiOpts.deckDebounceMs)};
    build.timer.unref?.();
    this.deckBuilds.set(room.code, build);
  }

  private async buildDeck(code: string, key: string): Promise<void> {
    const room = this.rooms.get(code);
    const ask = room && room.phase === 'lobby' && deckInputsKey(room) === key ? deckAsk(room, this.catalog) : undefined;
    if (!ask) {
      if (this.deckBuilds.get(code)?.key === key) this.deckBuilds.delete(code);
      return;
    }
    const started = this.now();
    const r = await withBudget(signal => this.ai!.deck(ask, signal), this.aiOpts.deckBudgetMs);
    if (this.deckBuilds.get(code)?.key === key) this.deckBuilds.delete(code);
    const ids = r.ok ? acceptShortlist(r.value.shortlist, ask.candidates.map(c => c.id), ask.deckSize) : [];
    const fresh = this.rooms.get(code);
    // Moods or rules may have changed while Bedrock was answering; a stale shortlist is dropped.
    const usable = ids.length > 0 && fresh?.phase === 'lobby' && deckInputsKey(fresh) === key;
    if (usable) fresh.preparedDeck = {inputsHash: key, titleIds: ids, source: 'ai', builtAt: this.now()};
    const error = !r.ok ? r.error : !ids.length ? 'no valid ids' : !usable ? 'stale' : undefined;
    this.report({task: 'deck', outcome: usable ? 'ai' : 'fallback', ms: this.now() - started, ...(error ? {error} : {})});
  }

  private async writeReason(room: Room): Promise<void> {
    const decidedAt = room.verdict?.decidedAt;
    const id = `${room.code}:${decidedAt}`;
    if (decidedAt === undefined || this.reasonsInFlight.has(id)) return;
    this.reasonsInFlight.add(id);
    const ask = reasonAsk(room, this.catalog);
    const started = this.now();
    const r = ask ? await withBudget(signal => this.ai!.reason(ask.request, signal), this.aiOpts.reasonBudgetMs) : undefined;
    this.reasonsInFlight.delete(id);
    const reason = r?.ok ? acceptReason(r.value, ask!.titles) : undefined;
    const fresh = this.rooms.get(room.code);
    // The tick may already have shown the template (deadline passed); then this answer is too late.
    const shown = fresh?.verdict?.decidedAt === decidedAt && revealVerdict(fresh, reason);
    if (shown) this.broadcast(fresh);
    const error = !r ? 'no request' : !r.ok ? r.error : !reason ? 'rejected by checks' : !shown ? 'late' : undefined;
    this.report({task: 'reason', outcome: reason && shown ? 'ai' : 'fallback', ms: this.now() - started, ...(error ? {error} : {})});
  }

  private report(event: AiEvent): void {
    this.aiOpts.onAiEvent?.(event);
  }
}
