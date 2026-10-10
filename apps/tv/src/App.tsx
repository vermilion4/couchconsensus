// Walking skeleton of the TV flow: Home → Lobby (QR + room code + live connection).
// Scoreboard and Verdict screens, room restore and the voter list come next.
import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import QRCode from '@amazon-devices/react-native-qrcode-svg';
import {CreateRoomResponse, PROTOCOL_VERSION, ServerMessage} from '@couch/protocol';
import {color} from '@couch/theme';
import {SERVER_URL} from './server-url';

type Room = {roomCode: string; joinUrl: string; hostToken: string};
type Conn = 'connecting' | 'connected' | 'reconnecting' | 'rejected';

// TODO(room restore, US-12): persist this and the host token with AsyncStorage.
const clientInstallId = `tv-${Math.random().toString(36).slice(2, 12)}`;

export const App = () => {
  const [room, setRoom] = useState<Room>();
  return room ? <Lobby room={room} /> : <Home onRoom={setRoom} />;
};

const Home = ({onRoom}: {onRoom: (r: Room) => void}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [focused, setFocused] = useState(false);

  const start = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({clientInstallId}),
      });
      if (!res.ok) throw new Error(`Server said ${res.status}`);
      onRoom(CreateRoomResponse.parse(await res.json()));
    } catch (e) {
      setError(`Could not reach the referee: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.brand}>CouchConsensus</Text>
      <Text style={styles.tagline}>Everyone votes on their phone. The TV picks one movie.</Text>
      <Pressable
        hasTVPreferredFocus
        disabled={busy}
        onPress={start}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.button, focused && styles.buttonFocused]}>
        <Text style={[styles.buttonText, focused && styles.buttonTextFocused]}>{busy ? 'Starting…' : 'Start a room'}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
};

const Lobby = ({room}: {room: Room}) => {
  const [conn, setConn] = useState<Conn>('connecting');

  useEffect(() => {
    let ws: WebSocket | undefined;
    let stopped = false;
    let retry = 0;
    const open = () => {
      ws = new WebSocket(`${SERVER_URL.replace(/^http/, 'ws')}/ws`);
      ws.onopen = () => {
        retry = 0;
        ws?.send(JSON.stringify({type: 'hello', roomCode: room.roomCode, role: 'host', token: room.hostToken}));
      };
      ws.onmessage = e => {
        const parsed = ServerMessage.safeParse(JSON.parse(String(e.data)));
        if (!parsed.success) return;
        const m = parsed.data;
        if (m.type === 'welcome' && m.protocol === PROTOCOL_VERSION) setConn('connected');
        if (m.type === 'error' && m.fatal) {
          stopped = true;
          setConn('rejected');
        }
      };
      ws.onclose = () => {
        if (stopped) return;
        setConn('reconnecting');
        setTimeout(open, Math.min(5000, 500 * 2 ** retry++));
      };
    };
    open();
    return () => {
      stopped = true;
      ws?.close();
    };
  }, [room]);

  return (
    <View style={[styles.screen, styles.lobby]}>
      <View style={styles.lobbyLeft}>
        <Text style={styles.label}>Scan to join</Text>
        <View style={styles.qrBox}>
          <QRCode value={room.joinUrl} size={360} ecl="M" quietZone={16} />
        </View>
      </View>
      <View style={styles.lobbyRight}>
        <Text style={styles.label}>Room code</Text>
        <Text style={styles.code}>{room.roomCode}</Text>
        <Text style={styles.body}>{room.joinUrl}</Text>
        <Text style={styles.body}>Waiting for at least 2 people to join…</Text>
        <Text style={[styles.status, conn === 'connected' ? styles.ok : styles.warn]}>● {conn}</Text>
      </View>
    </View>
  );
};

// 10-foot type scale: body ≥ 28 px at 1080p (ARCHITECTURE §8). Colors: @couch/theme.
const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: color.night, padding: 120, justifyContent: 'center'},
  brand: {color: color.glow, fontSize: 96, fontWeight: '800'},
  tagline: {color: color.mist, fontSize: 34, marginTop: 16, marginBottom: 64},
  button: {
    alignSelf: 'flex-start',
    paddingVertical: 30,
    paddingHorizontal: 56,
    borderRadius: 20,
    backgroundColor: color.couch,
    borderWidth: 6,
    borderColor: 'transparent',
  },
  // Focus = Fire TV orange + Glow ring; text switches to Night (5.3:1 on orange).
  buttonFocused: {backgroundColor: color.fireOrange, borderColor: color.glow, transform: [{scale: 1.05}]},
  buttonText: {color: color.glow, fontSize: 40, fontWeight: '700'},
  buttonTextFocused: {color: color.night},
  error: {color: color.error, fontSize: 28, marginTop: 32},
  lobby: {flexDirection: 'row', alignItems: 'center'},
  lobbyLeft: {flex: 1, alignItems: 'center'},
  lobbyRight: {flex: 1},
  label: {color: color.mist, fontSize: 28, marginBottom: 16},
  qrBox: {backgroundColor: '#ffffff', padding: 46, borderRadius: 28},
  code: {color: color.glow, fontSize: 160, fontWeight: '800'},
  body: {color: color.glow, fontSize: 28, marginTop: 16},
  status: {fontSize: 28, marginTop: 32},
  ok: {color: '#5EE6A0'},
  warn: {color: color.ember},
});
