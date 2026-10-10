// Waiting (done with my deck), Result (PH-4), and the short holding/closed states.
import type {VoteValue, VoterView} from '@couch/protocol';
import type {RoomClient} from '@couch/client';
import {formatClock, useSecondsLeft} from '../useRoom';

export function Waiting({client, view}: {client: RoomClient; view: VoterView}) {
  const seconds = useSecondsLeft(view.round?.timer.endsAt, client.clockOffset);
  return (
    <main class="screen">
      <p class="eyebrow">Room {view.roomCode}</p>
      <div class="me" aria-hidden="true">
        <div class="head">{view.me.nickname}</div>
        <div class="shoulders" />
      </div>
      <h1>You're done. Look up at the TV.</h1>
      <p class="muted">The referee calls it when everyone finishes or the timer runs out ({formatClock(seconds)} left).</p>
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
    <main class="screen">
      <p class="eyebrow">Tonight's pick</p>
      <img class="poster result" src={r.title.posterUrl} alt="" />
      <h1>{r.title.title}</h1>
      <ul class="facts">
        <li>{r.title.runtimeMin} min</li>
        {r.title.genres.slice(0, 2).map(g => (
          <li key={g}>{g}</li>
        ))}
        {r.title.availability[0] && <li>Watch on {r.title.availability[0].serviceName}</li>}
      </ul>
      <p class="my-vote">{MY_VOTE[r.myVote]}</p>
      <p class="muted">“{r.reason}”</p>
      <p class="muted small footer">Enjoy the movie. This room closes in 24 hours.</p>
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
      <p class="muted">The host closed this room. Scan a new code on the TV to play again.</p>
    </main>
  );
}
