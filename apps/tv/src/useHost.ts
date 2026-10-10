// React binding for the host's RoomClient: re-renders on every state, view or rejection change.
import {useEffect, useReducer, useState} from 'react';
import {RoomClient} from '@couch/client';
import {SERVER_URL} from './server-url';
import type {HostSession} from './session';

export type HostClient = RoomClient<'host'>;

export function makeHostClient(s: HostSession): HostClient {
  return new RoomClient({url: `${SERVER_URL.replace(/^http/, 'ws')}/ws`, roomCode: s.roomCode, role: 'host', token: s.hostToken});
}

/** Starts the client on mount, stops it on unmount, and re-renders on every change. */
export function useHostClient(client: HostClient | undefined): void {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!client) return;
    const off = client.subscribe(() => rerender());
    if (client.state === 'connecting') client.start();
    return off;
  }, [client]);
}

/** Seconds left on a server-clocked timer, refreshed four times a second. */
export function useSecondsLeft(endsAt: number | undefined, clockOffset: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - (now + clockOffset)) / 1000));
}

export const formatClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Server poster paths are relative for the demo deck and absolute for TMDB. */
export const posterSource = (url: string) => ({uri: /^https?:/.test(url) ? url : `${SERVER_URL}${url}`});
