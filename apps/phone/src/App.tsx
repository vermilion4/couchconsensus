// Phone flow (Figma "Phone" screens): Join → Mood → Swipe → Waiting → Result, plus error and reconnect states.
import {useState} from 'preact/hooks';
import {JoinRoomResponse, Nickname, RoomCode} from '@couch/protocol';
import {screenFor} from './screen';
import {clearSeat, loadSeat, saveSeat, type Seat} from './seat';
import {useRoom} from './useRoom';
import {Lobby, Mood} from './screens/Mood';
import {Swipe} from './screens/Swipe';
import {Closed, Result, Thinking, Waiting} from './screens/After';

function roomCodeFromUrl(): string | undefined {
  const m = location.pathname.match(/^\/r\/([A-Za-z]{4})\/?$/);
  const code = m?.[1]?.toUpperCase();
  return code && RoomCode.safeParse(code).success ? code : undefined;
}

type JoinProblem = 'notFound' | 'full' | undefined;

export function App() {
  const roomCode = roomCodeFromUrl();
  const [seat, setSeat] = useState<Seat | undefined>(() => (roomCode ? loadSeat(roomCode) : undefined));
  const [problem, setProblem] = useState<JoinProblem>();

  if (!roomCode)
    return (
      <main class="screen">
        <h1>CouchConsensus</h1>
        <p class="body" style={{marginTop: 16}}>
          Scan the QR code on the TV to join a room.
        </p>
      </main>
    );
  if (problem === 'full') return <RoomFull roomCode={roomCode} onRetry={() => setProblem(undefined)} />;
  if (!seat) return <Join roomCode={roomCode} notFound={problem === 'notFound'} onSeat={setSeat} onProblem={setProblem} />;
  return (
    <Room
      roomCode={roomCode}
      seat={seat}
      onLost={p => {
        clearSeat(roomCode);
        setSeat(undefined);
        setProblem(p);
      }}
    />
  );
}

function Join(props: {roomCode: string; notFound: boolean; onSeat: (s: Seat) => void; onProblem: (p: JoinProblem) => void}) {
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
      const res = await fetch(`/api/rooms/${props.roomCode}/seats`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({nickname: nick.data}),
      });
      const body = await res.json();
      if (res.status === 404 || res.status === 410 || body.error === 'WRONG_PHASE') return props.onProblem('notFound');
      if (body.error === 'ROOM_FULL') return props.onProblem('full');
      if (!res.ok) throw new Error(body.message ?? 'Could not join');
      const seat = JoinRoomResponse.parse(body);
      saveSeat(props.roomCode, seat);
      props.onSeat(seat);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (props.notFound) return <NotFound roomCode={props.roomCode} />;

  return (
    <main class="screen join">
      <p class="eyebrow">Room {props.roomCode}</p>
      <h1>
        What should we
        <br />
        call you?
      </h1>
      <form onSubmit={submit}>
        <input
          value={name}
          onInput={e => setName((e.target as HTMLInputElement).value)}
          maxLength={12}
          autoComplete="nickname"
          autoFocus
          placeholder="Your name"
          aria-label="Your name"
          aria-invalid={error ? 'true' : undefined}
        />
        <p class={error ? 'hint error' : 'hint'}>{error ?? 'Up to 12 characters. Everyone in the room sees it.'}</p>
        <button type="submit" class="primary" disabled={busy}>
          {busy ? 'Joining…' : 'Join'}
        </button>
      </form>
      <p class="note">No app, no account. Your votes stay private.</p>
    </main>
  );
}

/** Figma "Phone / Room not found": fix the code right here instead of rescanning. */
function NotFound({roomCode}: {roomCode: string}) {
  const [code, setCode] = useState(roomCode);
  const go = (e: Event) => {
    e.preventDefault();
    const next = code.trim().toUpperCase();
    if (RoomCode.safeParse(next).success) location.assign(`/r/${next}`);
  };
  return (
    <main class="screen join">
      <p class="eyebrow">Join a room</p>
      <h1>
        That room
        <br />
        isn't open
      </h1>
      <form onSubmit={go}>
        <input
          value={code}
          onInput={e => setCode((e.target as HTMLInputElement).value.toUpperCase())}
          maxLength={4}
          autoCapitalize="characters"
          autoComplete="off"
          aria-label="Room code"
          aria-invalid="true"
        />
        <p class="hint error" style={{whiteSpace: 'nowrap'}}>
          No room with code {roomCode}. Check the 4 letters on the TV.
        </p>
        <button type="submit" class="primary">
          Join room
        </button>
      </form>
      <p class="note">Rooms close after 24 hours or when the host ends them.</p>
    </main>
  );
}

function RoomFull({roomCode, onRetry}: {roomCode: string; onRetry: () => void}) {
  return (
    <main class="screen full">
      <p class="eyebrow">Room {roomCode}</p>
      <h1>
        This room
        <br />
        is full
      </h1>
      <p class="body">A room holds up to 8 people, and all the seats are taken. Ask the host to start a new room when this round ends.</p>
      <button class="primary" onClick={onRetry}>
        Try again
      </button>
      <p class="note">No app, no account. Your votes stay private.</p>
    </main>
  );
}

function Room({roomCode, seat, onLost}: {roomCode: string; seat: Seat; onLost: (p: JoinProblem) => void}) {
  const client = useRoom(roomCode, seat.seatToken);
  const [editingMood, setEditingMood] = useState(false);

  if (client.state === 'rejected') {
    // expired/closed room or a seat that no longer exists: start over at Join
    queueMicrotask(() => onLost(client.rejection === 'UNAUTHORIZED' ? undefined : 'notFound'));
    return null;
  }
  const view = client.view;
  const banner = client.state === 'reconnecting' && (
    <div class="banner" role="status">
      <span class="dot" /> Reconnecting. Your votes are saved.
    </div>
  );
  if (!view)
    return (
      <main class="screen">
        {banner}
        <p class="body">Connecting…</p>
      </main>
    );

  const screen = editingMood && view.phase === 'lobby' ? 'mood' : screenFor(view);
  return (
    <>
      {banner}
      {screen === 'mood' && <Mood client={client} view={view} onDone={() => setEditingMood(false)} />}
      {screen === 'lobby' && <Lobby view={view} onChangeMood={() => setEditingMood(true)} />}
      {screen === 'swipe' && <Swipe client={client} view={view} />}
      {screen === 'waiting' && <Waiting client={client} view={view} />}
      {screen === 'thinking' && <Thinking />}
      {screen === 'result' && <Result view={view} />}
      {screen === 'closed' && <Closed />}
    </>
  );
}
