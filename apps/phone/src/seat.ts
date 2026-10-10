// Seat token storage (ADR-0005, ADR-0010). Falls back to memory when storage is blocked.
const memory = new Map<string, string>();
const key = (roomCode: string) => `couch:seat:${roomCode}`;

export interface Seat {
  voterId: string;
  seatToken: string;
  nickname: string;
}

export function loadSeat(roomCode: string): Seat | undefined {
  try {
    const raw = localStorage.getItem(key(roomCode)) ?? memory.get(key(roomCode));
    return raw ? (JSON.parse(raw) as Seat) : undefined;
  } catch {
    const raw = memory.get(key(roomCode));
    return raw ? (JSON.parse(raw) as Seat) : undefined;
  }
}

export function saveSeat(roomCode: string, seat: Seat): void {
  const raw = JSON.stringify(seat);
  memory.set(key(roomCode), raw);
  try {
    localStorage.setItem(key(roomCode), raw);
  } catch {
    // private mode: memory only
  }
}
