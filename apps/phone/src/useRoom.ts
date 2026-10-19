// Preact binding for RoomClient: re-renders on every state, view or rejection change.
import {useEffect, useMemo, useReducer} from 'preact/hooks';
import {RoomClient} from '@couch/client';

export function useRoom(roomCode: string, seatToken: string) {
  const client = useMemo(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return new RoomClient({
      url: `${proto}://${location.host}/ws`,
      roomCode,
      role: 'voter',
      token: seatToken,
      fetchView: () =>
        fetch(`/api/rooms/${roomCode}/view`, {headers: {authorization: `Bearer ${seatToken}`}}).then(r => (r.ok ? r.json() : undefined)),
    });
  }, [roomCode, seatToken]);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const off = client.subscribe(() => rerender(undefined));
    client.start();
    return () => {
      off();
      client.stop();
    };
  }, [client]);

  return client;
}

/** Seconds left on a server-clocked timer, refreshed four times a second. */
export function useSecondsLeft(endsAt: number | undefined, clockOffset: number): number {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => tick(undefined), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - (Date.now() + clockOffset)) / 1000));
}

export const formatClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
