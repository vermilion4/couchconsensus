// Walking skeleton of the phone flow: Join → connected. Mood, Swipe, Waiting and Result screens come next.
import {useEffect, useState} from 'preact/hooks';
import {JoinRoomResponse, Nickname, RoomCode} from '@couch/protocol';
import {connect, type ConnState} from './connection';
import {loadSeat, saveSeat, type Seat} from './seat';

function roomCodeFromUrl(): string | undefined {
  const m = location.pathname.match(/^\/r\/([A-Za-z]{4})\/?$/);
  const code = m?.[1]?.toUpperCase();
  return code && RoomCode.safeParse(code).success ? code : undefined;
}

export function App() {
  const roomCode = roomCodeFromUrl();
  const [seat, setSeat] = useState<Seat | undefined>(() => (roomCode ? loadSeat(roomCode) : undefined));

  if (!roomCode)
    return (
      <main class="screen">
        <h1>CouchConsensus</h1>
        <p>Scan the QR code on the TV to join a room.</p>
      </main>
    );

  return seat ? <Connected roomCode={roomCode} seat={seat} /> : <Join roomCode={roomCode} onSeat={setSeat} />;
}

function Join({roomCode, onSeat}: {roomCode: string; onSeat: (s: Seat) => void}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    const nick = Nickname.safeParse(name);
    if (!nick.success) return setError(nick.error.issues[0]?.message ?? 'Check your name');
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/rooms/${roomCode}/seats`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({nickname: nick.data}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? 'Could not join');
      const seat = JoinRoomResponse.parse(body);
      saveSeat(roomCode, seat);
      onSeat(seat);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main class="screen">
      <p class="code">Room {roomCode}</p>
      <h1>What should we call you?</h1>
      <form onSubmit={submit}>
        <input
          value={name}
          onInput={e => setName((e.target as HTMLInputElement).value)}
          maxLength={12}
          autoComplete="nickname"
          autoFocus
          placeholder="Your name"
          aria-label="Your name"
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Joining…' : 'Join'}
        </button>
      </form>
      {error && <p class="error">{error}</p>}
      <p class="hint">No app, no account. Your votes stay private.</p>
    </main>
  );
}

function Connected({roomCode, seat}: {roomCode: string; seat: Seat}) {
  const [state, setState] = useState<ConnState>('connecting');
  const [detail, setDetail] = useState<string>();

  useEffect(
    () =>
      connect(
        roomCode,
        seat.seatToken,
        (s, d) => {
          setState(s);
          setDetail(d);
        },
        () => {},
      ),
    [roomCode, seat.seatToken],
  );

  return (
    <main class="screen">
      <p class="code">Room {roomCode}</p>
      <h1>Hi {seat.nickname}!</h1>
      {state === 'open' && <p>You're in. Look up at the TV.</p>}
      {state === 'connecting' && <p>Connecting…</p>}
      {state === 'closed' && <p>Reconnecting…</p>}
      {state === 'rejected' && <p class="error">{detail ?? 'This room is no longer available.'}</p>}
    </main>
  );
}
