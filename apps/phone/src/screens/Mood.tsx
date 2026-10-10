// Mood (US-6, PH-6): up to three chips plus optional free text, or skip. Then wait for the host.
import {useState} from 'preact/hooks';
import type {MoodChip, VoterView} from '@couch/protocol';
import type {RoomClient} from '@couch/client';

const CHIPS: [MoodChip, string][] = [
  ['funny', 'Funny'],
  ['cozy', 'Cozy'],
  ['thrilling', 'Thrilling'],
  ['scary', 'Scary'],
  ['romantic', 'Romantic'],
  ['mindBending', 'Mind-bending'],
  ['epic', 'Epic'],
  ['feelGood', 'Feel-good'],
  ['familyFriendly', 'Family-friendly'],
  ['short', 'Short'],
];

export function Mood({client, view, onDone}: {client: RoomClient; view: VoterView; onDone: () => void}) {
  const [chips, setChips] = useState<MoodChip[]>(view.me.mood?.chips ?? []);
  const [text, setText] = useState(view.me.mood?.text ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const toggle = (c: MoodChip) =>
    setChips(cur => (cur.includes(c) ? cur.filter(x => x !== c) : cur.length < 3 ? [...cur, c] : cur));

  const submit = async (skipped: boolean) => {
    setBusy(true);
    const r = await client.send(
      skipped ? {type: 'setMood', chips: [], skipped: true} : {type: 'setMood', chips, ...(text.trim() ? {text: text.trim()} : {})},
    );
    setBusy(false);
    if (r.ok) onDone();
    else setError(r.message);
  };

  return (
    <main class="screen">
      <p class="eyebrow">Room {view.roomCode}</p>
      <h1>What are you in the mood for?</h1>
      <p class="muted small">Pick up to three. The room's moods shape the deck.</p>
      <div class="chips" role="group" aria-label="Moods">
        {CHIPS.map(([id, label]) => (
          <button key={id} class={chips.includes(id) ? 'chip on' : 'chip'} aria-pressed={chips.includes(id)} onClick={() => toggle(id)}>
            {label}
          </button>
        ))}
      </div>
      <label class="muted small" for="mood-text">
        Or say it your way
      </label>
      <input id="mood-text" value={text} maxLength={80} placeholder="something with a heist" onInput={e => setText((e.target as HTMLInputElement).value)} />
      {error && <p class="error small">{error}</p>}
      <div class="footer stack">
        <button class="primary" disabled={busy || (chips.length === 0 && !text.trim())} onClick={() => submit(false)}>
          Continue
        </button>
        <button class="text" disabled={busy} onClick={() => submit(true)}>
          Skip
        </button>
      </div>
    </main>
  );
}

export function Lobby({view, onChangeMood}: {view: VoterView; onChangeMood: () => void}) {
  return (
    <main class="screen center">
      <p class="eyebrow">Room {view.roomCode}</p>
      <h1>You're in, {view.me.nickname}.</h1>
      <p class="muted">
        {view.roomSize} {view.roomSize === 1 ? 'person is' : 'people are'} here. The host starts the round from the TV.
      </p>
      <button class="text" onClick={onChangeMood}>
        Change my mood
      </button>
    </main>
  );
}
