// Waiting (done with my deck), Result (PH-4), and the short holding/closed states,
// built to Figma "Phone / Waiting" and "Phone / Result".
import type {VoteValue, VoterView} from '@couch/protocol';
import {color, voterColor} from '@couch/theme';
import type {RoomClient} from '@couch/client';

export function Waiting({view}: {client: RoomClient; view: VoterView}) {
  const mine = voterColor(view.me.colorIndex ?? 0);
  const progress = view.round?.progress ?? [];
  const done = progress.filter(p => p.finished).length;
  return (
    <main class="screen waiting">
      <p class="eyebrow">Room {view.roomCode}</p>
      <div class="me" aria-hidden="true">
        <div class="head" style={{background: mine}}>
          {view.me.nickname}
        </div>
        <div class="shoulders" style={{background: mine}} />
      </div>
      <h1>
        You're done.
        <br />
        Look up at the TV.
      </h1>
      <p class="body">The referee calls it when everyone finishes or the timer runs out.</p>
      {progress.length > 0 && (
        <div class="finished" aria-label={`${done} of ${progress.length} finished`}>
          <span class="dots" aria-hidden="true">
            {progress.map(p => (
              <span key={p.colorIndex} class="dot" style={{background: p.finished ? voterColor(p.colorIndex) : color.cushion}} />
            ))}
          </span>
          {done} of {progress.length} finished
        </div>
      )}
    </main>
  );
}

const MY_VOTE: Record<VoteValue | 'notReached' | 'notInRound', string> = {
  yes: 'You said yes',
  superYes: 'You gave it a super-yes ★',
  no: 'You said no. The room said yes.',
  veto: 'You vetoed it',
  notReached: "You didn't reach this card",
  notInRound: 'You joined after this round',
};

export function Result({view}: {view: VoterView}) {
  const r = view.result!;
  return (
    <main class="screen result">
      <p class="eyebrow">Tonight's pick</p>
      <img class="poster-mini" src={r.title.posterUrl} alt="" />
      <h2 class="result-title">{r.title.title}</h2>
      <ul class="facts">
        <li>{r.title.runtimeMin} min</li>
        {r.title.genres.slice(0, 1).map(g => (
          <li key={g}>{g}</li>
        ))}
        {r.title.availability[0] && <li>Watch on {r.title.availability[0].serviceName}</li>}
      </ul>
      <p class="my-vote">
        <span class="dot" style={{background: voterColor(view.me.colorIndex ?? 0)}} />
        {MY_VOTE[r.myVote]}
      </p>
      <p class="reason">“{r.reason}”</p>
      <p class="note small">Enjoy the movie. This room closes in 24 hours.</p>
    </main>
  );
}

export function Thinking() {
  return (
    <main class="screen center">
      <h1>The referee is thinking…</h1>
    </main>
  );
}

export function Closed() {
  return (
    <main class="screen center">
      <h1>That's a wrap.</h1>
      <p class="body" style={{marginTop: 16}}>
        The host closed this room. Scan a new code on the TV to play again.
      </p>
    </main>
  );
}
