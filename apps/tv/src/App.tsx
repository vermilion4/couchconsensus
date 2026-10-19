// The TV (host) app: Home → Lobby → Scoreboard → Verdict, with Resume room after a relaunch (US-12).
// The server owns the room; the TV renders the TV projection and sends host commands.
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Text, View} from 'react-native';
import type {Command} from '@couch/client';
import {CreateRoomResponse} from '@couch/protocol';
import {color} from '@couch/theme';
import {SERVER_URL} from './server-url';
import {clearSession, installId, loadSession, saveSession, type HostSession} from './session';
import {makeHostClient, useHostClient, type HostClient} from './useHost';
import {preloadSounds} from './sound';
import {tvScreenFor} from './tv-screen';
import {Home, Resume, Splash} from './screens/Home';
import {Lobby} from './screens/Lobby';
import {Scoreboard} from './screens/Scoreboard';
import {Closed, Thinking, Verdict} from './screens/Verdict';
import {sheet, Toast} from './ui';

/** Sends a host command; a refusal shows as a toast. Resolves true when the server accepted it. */
export type Send = (cmd: Command) => Promise<boolean>;

type Mode = 'boot' | 'home' | 'resume' | 'room';

export const App = () => {
  const [mode, setMode] = useState<Mode>('boot');
  const [client, setClient] = useState<HostClient>();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const [toast, setToast] = useState<string>();
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useHostClient(client);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(undefined), 4000);
  }, []);

  const goHome = useCallback(
    async (message?: string) => {
      client?.stop();
      setClient(undefined);
      await clearSession();
      setNote(message);
      setMode('home');
    },
    [client],
  );

  // Boot: reconnect to a saved room if there is one; the first view decides whether to offer Resume.
  useEffect(() => {
    preloadSounds();
    void loadSession().then(saved => {
      if (!saved) return setMode('home');
      setClient(makeHostClient(saved));
      setMode('resume');
    });
  }, []);

  // A room the server no longer knows (expired, closed, wrong token) sends the TV back home.
  useEffect(() => {
    if (client?.state !== 'rejected') return;
    void goHome(mode === 'resume' ? undefined : 'That room has closed. Start a new one.');
  }, [client?.state, client, mode, goHome]);
  useEffect(() => {
    if (mode === 'resume' && client?.view?.phase === 'closed') void goHome();
  }, [mode, client?.view?.phase, goHome]);

  const send: Send = useCallback(
    async cmd => {
      if (!client) return false;
      const r = await client.send(cmd);
      if (!r.ok) showToast(r.message);
      return r.ok;
    },
    [client, showToast],
  );

  const create = async () => {
    setBusy(true);
    setNote(undefined);
    try {
      // Starting over from Resume closes the old room so its phones don't wait on a TV that left.
      if (client) {
        await Promise.race([client.send({type: 'closeRoom'}), new Promise<void>(r => setTimeout(() => r(), 1000))]);
        client.stop();
      }
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({clientInstallId: await installId()}),
      });
      if (!res.ok) throw new Error(`the server said ${res.status}`);
      const room = CreateRoomResponse.parse(await res.json());
      const session: HostSession = {roomCode: room.roomCode, joinUrl: room.joinUrl, hostToken: room.hostToken};
      await saveSession(session);
      setClient(makeHostClient(session));
      setMode('room');
    } catch (e) {
      setClient(undefined);
      setMode('home');
      setNote(`Could not reach the referee: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const done = async () => {
    await send({type: 'closeRoom'});
    await goHome();
  };

  const view = client?.view;
  let screen: React.ReactNode;
  if (mode === 'boot' || (mode === 'resume' && !view)) screen = <Splash />;
  else if (mode === 'home' || !client || !view) screen = <Home onStart={create} busy={busy} note={note} />;
  else if (mode === 'resume') screen = <Resume view={view} onResume={() => setMode('room')} onNew={create} />;
  else
    switch (tvScreenFor(view)) {
      case 'lobby':
        screen = <Lobby view={view} send={send} />;
        break;
      case 'scoreboard':
        screen = <Scoreboard client={client} view={view} send={send} />;
        break;
      case 'thinking':
        screen = <Thinking />;
        break;
      case 'verdict':
        screen = <Verdict view={view} send={send} onDone={done} />;
        break;
      case 'closed':
        screen = <Closed onHome={() => void goHome()} />;
        break;
    }

  return (
    <View style={s.root}>
      {screen}
      {mode === 'room' && client?.state === 'reconnecting' ? (
        <View style={s.pill} accessibilityLiveRegion="polite">
          <View style={s.dot} />
          <Text style={s.pillText}>Reconnecting to the referee…</Text>
        </View>
      ) : null}
      <Toast text={toast} />
    </View>
  );
};

const s = sheet({
  root: {flex: 1, backgroundColor: color.night},
  pill: {
    position: 'absolute',
    top: 64,
    right: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: color.cushion,
  },
  dot: {width: 14, height: 14, borderRadius: 7, backgroundColor: color.ember},
  pillText: {color: color.glow, fontSize: 26, fontWeight: '600'},
});
