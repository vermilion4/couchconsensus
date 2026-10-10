// Walking-skeleton RoomManager: create rooms, seat voters, authenticate tokens.
// Phases, rounds, the per-room command queue and DynamoDB persistence (ADR-0003) come next.
import {DEFAULT_RULES, MAX_VOTERS, ROOM_TTL_MS, type GroundRules} from '@couch/protocol';
import {hashToken, newRoomCode, newToken, newVoterId, tokenMatches} from './tokens';

export interface Voter {
  id: string;
  nickname: string;
  seatTokenHash: string;
  joinedAt: number;
}

export interface Room {
  code: string;
  rev: number;
  createdAt: number;
  expiresAt: number;
  hostTokenHash: string;
  region: string;
  rules: GroundRules;
  voters: Voter[];
}

export type Auth = {role: 'host'} | {role: 'voter'; voterId: string};

export class RoomError extends Error {
  constructor(
    readonly code: 'ROOM_NOT_FOUND' | 'ROOM_EXPIRED' | 'ROOM_FULL' | 'UNAUTHORIZED',
    message: string,
  ) {
    super(message);
  }
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor(private readonly now: () => number = Date.now) {}

  create(region: string): {room: Room; hostToken: string} {
    let code = newRoomCode();
    while (this.rooms.has(code) && !this.isExpired(this.rooms.get(code)!)) code = newRoomCode();
    const hostToken = newToken();
    const t = this.now();
    const room: Room = {
      code,
      rev: 0,
      createdAt: t,
      expiresAt: t + ROOM_TTL_MS,
      hostTokenHash: hashToken(hostToken),
      region,
      rules: {...DEFAULT_RULES},
      voters: [],
    };
    this.rooms.set(code, room);
    return {room, hostToken};
  }

  get(code: string): Room {
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('ROOM_NOT_FOUND', `No room ${code}`);
    if (this.isExpired(room)) {
      this.rooms.delete(code);
      throw new RoomError('ROOM_EXPIRED', `Room ${code} has expired`);
    }
    return room;
  }

  seat(code: string, nickname: string): {voter: Voter; seatToken: string} {
    const room = this.get(code);
    if (room.voters.length >= MAX_VOTERS) throw new RoomError('ROOM_FULL', 'This room is full');
    const seatToken = newToken();
    const voter: Voter = {
      id: newVoterId(),
      nickname: uniqueNickname(room, nickname),
      seatTokenHash: hashToken(seatToken),
      joinedAt: this.now(),
    };
    room.voters.push(voter);
    room.rev++;
    return {voter, seatToken};
  }

  authenticate(code: string, role: 'host' | 'voter', token: string): Auth {
    const room = this.get(code);
    if (role === 'host' && tokenMatches(token, room.hostTokenHash)) return {role: 'host'};
    if (role === 'voter') {
      const voter = room.voters.find(v => tokenMatches(token, v.seatTokenHash));
      if (voter) return {role: 'voter', voterId: voter.id};
    }
    throw new RoomError('UNAUTHORIZED', 'Invalid token for this room');
  }

  private isExpired(room: Room): boolean {
    return room.expiresAt <= this.now();
  }
}

/** "Sam", "Sam 2", … case-insensitive (invariant I9). Stays within 12 chars. */
function uniqueNickname(room: Room, wanted: string): string {
  const taken = new Set(room.voters.map(v => v.nickname.toLowerCase()));
  if (!taken.has(wanted.toLowerCase())) return wanted;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const candidate = wanted.slice(0, 12 - suffix.length) + suffix;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}
