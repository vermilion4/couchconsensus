// Swipe (US-4, US-5, PH-3, PH-5): one card at a time. Drag right = yes, left = no, or use the buttons.
// One veto and one super-yes per round; undo the last card. Sudden death: yes/no only.
import {useRef, useState} from 'preact/hooks';
import type {TitleCard, VoteValue, VoterView} from '@couch/protocol';
import type {RoomClient} from '@couch/client';
import {voterColor} from '@couch/theme';
import {formatClock, useSecondsLeft} from '../useRoom';

const SWIPE_PX = 90;

export function Swipe({client, view}: {client: RoomClient; view: VoterView}) {
  const round = view.round!;
  const ballot = view.me.ballot!;
  const index = ballot.votes.length;
  const card = round.deck[index];
  const seconds = useSecondsLeft(round.timer.endsAt, client.clockOffset);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [dx, setDx] = useState(0);
  const start = useRef<number | undefined>(undefined);
  const sudden = round.kind === 'suddenDeath';

  const vote = async (value: VoteValue) => {
    if (busy || !card) return;
    setBusy(true);
    setError(undefined);
    const r = await client.send({type: 'vote', roundNo: round.no, cardIndex: index, value});
    setBusy(false);
    setDx(0);
    if (!r.ok) setError(r.message);
  };
  const undo = async () => {
    if (busy || index === 0) return;
    setBusy(true);
    const r = await client.send({type: 'undo', roundNo: round.no, cardIndex: index - 1});
    setBusy(false);
    if (!r.ok) setError(r.message);
  };

  const onDown = (e: PointerEvent) => {
    start.current = e.clientX;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => start.current !== undefined && setDx(e.clientX - start.current);
  const onUp = () => {
    start.current = undefined;
    if (dx > SWIPE_PX) void vote('yes');
    else if (dx < -SWIPE_PX) void vote('no');
    else setDx(0);
  };

  if (!card) return null;
  const hint = dx > SWIPE_PX / 2 ? 'yes' : dx < -SWIPE_PX / 2 ? 'no' : undefined;

  return (
    <main class="screen swipe">
      <header class="deck-head">
        <span class={sudden ? 'count sudden' : 'count'}>{sudden ? `Sudden death, card ${index + 1} of ${round.deck.length}` : `Card ${index + 1} of ${round.deck.length}`}</span>
        <span class="clock" aria-label="Time left">
          {formatClock(seconds)}
        </span>
      </header>
      <div class="progress" aria-hidden="true">
        <div style={{width: `${(index / round.deck.length) * 100}%`, background: voterColor(view.me.colorIndex ?? 0)}} />
      </div>

      <article
        class={`card ${hint ?? ''}`}
        style={{transform: `translateX(${dx}px) rotate(${dx / 20}deg)`}}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => setDx(0)}
        aria-label={`${card.title}, ${card.year}`}
      >
        <CardBody card={card} />
        {hint && <span class={`stamp ${hint}`}>{hint === 'yes' ? 'Yes' : 'No'}</span>}
      </article>

      {error && <p class="hint error">{error}</p>}

      <nav class="votes" aria-label="Vote">
        <VoteButton label="No" glyph="✕" big onClick={() => vote('no')} disabled={busy} />
        {/* Sudden death keeps both visible (Figma) but they can't be used this round. */}
        <VoteButton label="Veto" glyph="⊘" tone="veto" onClick={() => vote('veto')} disabled={busy || sudden || !ballot.vetoAvailable} />
        <VoteButton label="Super-yes" glyph="★" tone="super" onClick={() => vote('superYes')} disabled={busy || sudden || !ballot.superYesAvailable} />
        <VoteButton label="Yes" glyph="✓" big primary onClick={() => vote('yes')} disabled={busy} />
      </nav>
      <button class="undo" onClick={undo} disabled={busy || index === 0}>
        Undo last card
      </button>
      <p class="swipe-hint">{sudden ? 'No vetoes or super-yes in sudden death.' : 'Swipe right for yes, left for no.'}</p>
    </main>
  );
}

export function CardBody({card}: {card: TitleCard}) {
  return (
    <>
      <img class="poster" src={card.posterUrl} alt="" draggable={false} />
      <div class="card-body">
        <h2 class="card-title">{card.title}</h2>
        <ul class="facts">
          <li>{card.runtimeMin} min</li>
          {card.genres.slice(0, 2).map(g => (
            <li key={g}>{g}</li>
          ))}
        </ul>
        <p class="logline">{card.logline}</p>
        {card.availability[0] && <p class="service">On {card.availability.map(a => a.serviceName).join(', ')}</p>}
      </div>
    </>
  );
}

function VoteButton(p: {label: string; glyph: string; onClick: () => void; disabled?: boolean; big?: boolean; primary?: boolean; tone?: 'veto' | 'super'}) {
  return (
    <button class={`vote ${p.big ? "big" : ""} ${p.primary ? "yes" : ""} ${p.tone ?? ""}`} onClick={p.onClick} disabled={p.disabled} aria-label={p.label}>
      <span class="glyph" aria-hidden="true">
        {p.glyph}
      </span>
      <span class="vote-label">{p.label}</span>
    </button>
  );
}
