// A connection to the session service (ADR-0004), used by the phone (voter) and the TV (host):
// hello → welcome → views, commands with acks, newest-view-wins, server clock offset, resend after reconnect.
import {ServerMessage, TvView, VoterView, type ClientCommand, type ErrorCode} from '@couch/protocol';

export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((e: {data: string}) => void) | null;
  onclose: (() => void) | null;
}

export type ConnState = 'connecting' | 'open' | 'reconnecting' | 'rejected';
export type CommandResult = {ok: true} | {ok: false; error: ErrorCode; message: string};
export type Role = 'host' | 'voter';
/** The host is the TV, so it gets the TV projection; a voter gets their own. */
export type ViewFor<R extends Role> = R extends 'host' ? TvView : VoterView;
/** A command as the UI writes it; the client adds the cmdId. */
export type Command = ClientCommand extends infer C ? (C extends {cmdId: string} ? Omit<C, 'cmdId'> : never) : never;

interface Options<R extends Role> {
  url: string;
  roomCode: string;
  role: R;
  /** Seat token for a voter, host token for the TV. */
  token: string;
  socket?: (url: string) => SocketLike;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => void;
  /**
   * Fetches the current view over HTTP (GET /api/rooms/:code/view, ADR-0004). Used when a WebSocket
   * message is lost or garbled: Vega's WebSocket can mangle a message that spans TCP segments.
   */
  fetchView?: () => Promise<unknown>;
}

const OPEN = 1;
/** How long a newer view may lag behind its ack before the client reconnects to fetch it. */
const RESYNC_MS = 1500;

/** The slice of Web Crypto we use; typed here so the TV build (no DOM lib) compiles too. */
type WebCrypto = {randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array};

/**
 * RFC 4122 v4. crypto.randomUUID needs a secure context (LAN development runs over plain http), and the
 * TV's JS engine may have no Web Crypto at all. A cmdId only has to be unique, not secret, so Math.random
 * is an acceptable last resort.
 */
export function uuid(): string {
  const g = globalThis as {crypto?: WebCrypto; isSecureContext?: boolean};
  const c = g.crypto;
  if (typeof c?.randomUUID === 'function' && g.isSecureContext !== false) return c.randomUUID();
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export class RoomClient<R extends Role = 'voter'> {
  state: ConnState = 'connecting';
  view: ViewFor<R> | undefined;
  /** serverNow − local now, refreshed with every view; add it to Date.now() to get server time. */
  clockOffset = 0;
  rejection: ErrorCode | undefined;
  /** Set when the server sent something this client can't read: a protocol mismatch worth surfacing. */
  protocolError: string | undefined;
  /** Counts of server messages handled, and of views dropped and why (diagnostics). */
  readonly stats = {messages: 0, views: 0, stale: 0, unreadable: 0, invalid: 0, recovered: 0, resyncs: 0};

  private ws: SocketLike | undefined;
  private welcomed = false;
  private stopped = false;
  private retry = 0;
  private pending = new Map<string, {message: object; resolve: (r: CommandResult) => void}>();
  private listeners = new Set<() => void>();
  private readonly makeSocket: (url: string) => SocketLike;
  private readonly now: () => number;
  private readonly schedule: (fn: () => void, ms: number) => void;

  constructor(private readonly opts: Options<R>) {
    this.makeSocket = opts.socket ?? (url => new WebSocket(url) as unknown as SocketLike);
    this.now = opts.now ?? Date.now;
    this.schedule = opts.schedule ?? ((fn, ms) => void setTimeout(fn, ms));
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    this.ws?.close();
  }

  send(command: Command): Promise<CommandResult> {
    const cmdId = uuid();
    const message = {...command, cmdId};
    return new Promise(resolve => {
      this.pending.set(cmdId, {message, resolve});
      if (this.welcomed && this.ws?.readyState === OPEN) this.ws.send(JSON.stringify(message));
    });
  }

  private recovering: Promise<void> | undefined;

  /** Fetch the current view over HTTP; one request at a time. */
  private recover(): Promise<void> {
    const fetchView = this.opts.fetchView;
    if (!fetchView || this.stopped) return Promise.resolve();
    this.recovering ??= fetchView()
      .then(raw => {
        const parsed = (this.opts.role === 'host' ? TvView : VoterView).safeParse(raw);
        if (parsed.success && this.applyView(parsed.data)) {
          this.stats.recovered++;
          this.emit();
        }
      })
      .catch(() => undefined)
      .finally(() => (this.recovering = undefined));
    return this.recovering;
  }

  /** Newest view wins; returns whether this one was newer and is now shown. */
  private applyView(view: TvView | VoterView): boolean {
    if (view.audience !== (this.opts.role === 'host' ? 'tv' : 'voter')) return false;
    if (this.view && view.rev <= this.view.rev) {
      this.stats.stale++;
      return false;
    }
    this.stats.views++;
    this.view = view as ViewFor<R>;
    this.clockOffset = view.serverNow - this.now();
    return true;
  }

  private async resyncIfBehind(rev: number) {
    if (this.stopped || !this.view || this.view.rev >= rev) return;
    await this.recover(); // HTTP first: it can't be garbled the way a WebSocket frame can
    if (this.stopped || !this.view || this.view.rev >= rev) return;
    this.stats.resyncs++;
    this.ws?.close(); // then reconnect: the server sends the current view on attach
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private open() {
    const ws = (this.ws = this.makeSocket(this.opts.url));
    this.welcomed = false;
    ws.onopen = () => {
      this.retry = 0;
      ws.send(JSON.stringify({type: 'hello', roomCode: this.opts.roomCode, role: this.opts.role, token: this.opts.token}));
    };
    ws.onmessage = e => this.receive(e.data);
    ws.onclose = () => {
      if (this.stopped || this.state === 'rejected') return;
      this.state = 'reconnecting';
      this.emit();
      // back off 0.5 s, 1 s, 2 s … capped at 5 s
      this.schedule(() => this.open(), Math.min(5000, 500 * 2 ** this.retry++));
    };
  }

  private receive(data: string) {
    this.stats.messages++;
    let parsed;
    try {
      parsed = ServerMessage.safeParse(JSON.parse(data));
    } catch (e) {
      this.stats.unreadable++;
      this.protocolError = `unreadable message: ${(e as Error).message}`;
      this.emit();
      void this.recover(); // the lost message was most likely a view; fetch the current one
      return;
    }
    if (!parsed.success) {
      // A message we can't read means client and server disagree on the protocol; say so instead of freezing.
      this.stats.invalid++;
      const issue = parsed.error.issues[0];
      this.protocolError = `${issue?.path.join('.')}: ${issue?.message}`;
      console.warn(`[room-client] dropped invalid server message: ${this.protocolError}`);
      this.emit();
      void this.recover();
      return;
    }
    const m = parsed.data;
    switch (m.type) {
      case 'welcome':
        this.welcomed = true;
        this.state = 'open';
        // anything not acknowledged before the drop goes again; the server applies each cmdId once
        for (const {message} of this.pending.values()) this.ws?.send(JSON.stringify(message));
        break;
      case 'view':
        if (!this.applyView(m.view)) return;
        break;
      case 'ack':
      case 'nack': {
        const p = this.pending.get(m.cmdId);
        if (!p) return;
        this.pending.delete(m.cmdId);
        p.resolve(m.ok ? {ok: true} : {ok: false, error: m.error, message: m.message});
        // The ack carries the room's rev. A view at that rev should follow; if it never does, the screen
        // would sit on an old state. Reconnecting makes the server send the current view on attach.
        if (m.ok && this.view && m.rev > this.view.rev) this.schedule(() => void this.resyncIfBehind(m.rev), RESYNC_MS);
        break;
      }
      case 'error':
        if (m.fatal) {
          this.state = 'rejected';
          this.rejection = m.error;
          this.stopped = true;
        }
        break;
      case 'pong':
        return;
    }
    this.emit();
  }
}
