import {describe, expect, it} from 'vitest';
import {ClientMessage, Nickname, RoomCode, ServerMessage, TvView} from './index';

const uuid = '3f1c2a9e-8b7d-4c1e-9f2a-1b2c3d4e5f60';

describe('primitives', () => {
  it('accepts only the 20-letter room code alphabet', () => {
    expect(RoomCode.safeParse('KDRM').success).toBe(true);
    expect(RoomCode.safeParse('KDRO').success).toBe(false); // O is excluded
    expect(RoomCode.safeParse('kdrm').success).toBe(false);
  });

  it('sanitises nicknames and caps them at 12 characters', () => {
    expect(Nickname.parse('  Sam​ ')).toBe('Sam');
    expect(Nickname.safeParse('ThirteenChars').success).toBe(false);
    expect(Nickname.safeParse('​').success).toBe(false);
  });
});

describe('client messages', () => {
  it('parses a vote command', () => {
    const m = ClientMessage.parse({type: 'vote', cmdId: uuid, roundNo: 1, cardIndex: 3, value: 'superYes'});
    expect(m.type).toBe('vote');
  });

  it('rejects a vote past the 15-card deck or with an unknown value', () => {
    expect(ClientMessage.safeParse({type: 'vote', cmdId: uuid, roundNo: 1, cardIndex: 15, value: 'yes'}).success).toBe(false);
    expect(ClientMessage.safeParse({type: 'vote', cmdId: uuid, roundNo: 1, cardIndex: 0, value: 'maybe'}).success).toBe(false);
  });
});

describe('views', () => {
  it('a TV view has no field that can carry a vote value (I8)', () => {
    const voterShape = TvView.shape.voters.element.shape;
    expect(Object.keys(voterShape).sort()).toEqual(['connected', 'finished', 'id', 'moodDone', 'nickname', 'progress']);
  });

  it('parses a welcome', () => {
    expect(ServerMessage.parse({type: 'welcome', role: 'host', protocol: 1}).type).toBe('welcome');
  });
});
