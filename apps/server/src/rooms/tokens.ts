// Capability tokens and room codes (ADR-0010).
import {createHash, randomBytes, randomInt, timingSafeEqual} from 'node:crypto';
import {ROOM_CODE_ALPHABET} from '@couch/protocol';

/** 256-bit random token, base64url. Returned to the client once; only its hash is stored. */
export const newToken = (): string => randomBytes(32).toString('base64url');

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

const BLOCKLIST = new Set(['DAMN', 'DUMB', 'FART', 'PUKE', 'CRAP', 'HELL']);

export function newRoomCode(): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < 4; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    if (!BLOCKLIST.has(code)) return code;
  }
}

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';
export function newVoterId(): string {
  let id = 'v_';
  for (let i = 0; i < 8; i++) id += BASE32[randomInt(32)];
  return id;
}
