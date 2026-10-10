// Dev helper: plays the TV and extra voters so one person can test the phone page.
// Usage: node scripts/demo-bots.mjs [baseUrl] [botCount] [--room CODE] [--delay ms]
// Without --room: creates a room, prints the join URL, waits for one human to join, starts the round,
// and has the bots vote (first card yes, the rest no). The TV connection stays open.
// With --room: the real TV app is the host; the bots join its room and vote one card every --delay ms.
import WebSocket from 'ws';

const flags = process.argv.slice(2);
const flag = name => {
  const i = flags.indexOf(name);
  return i < 0 ? undefined : flags.splice(i, 2)[1];
};
const roomFlag = flag('--room');
const delay = Number(flag('--delay') ?? 0);
const base = flags[0] ?? 'http://localhost:8080';
const bots = Number(flags[1] ?? 1);
const NAMES = ['Sam', 'Ada', 'Kofi', 'Mia', 'Lena', 'Raj', 'Tomás', 'Yui'];
const ws = (url) => new WebSocket(url.replace(/^http/, 'ws') + '/ws');
const post = (path, body) => fetch(base + path, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)}).then(r => r.json());
const id = () => crypto.randomUUID();

const room = roomFlag ? {roomCode: roomFlag} : await post('/api/rooms', {clientInstallId: 'demo-bots-0001'});
if (!roomFlag) console.log(`JOIN ${room.joinUrl.replace(/^https?:\/\/[^/]+/, base)}`);

if (!roomFlag) {
  const tv = ws(base);
  let started = false;
  let lastPhase;
  tv.on('open', () => tv.send(JSON.stringify({type: 'hello', roomCode: room.roomCode, role: 'host', token: room.hostToken})));
  tv.on('message', d => {
    const m = JSON.parse(String(d));
    if (m.type !== 'view') return;
    const v = m.view;
    if (v.phase !== lastPhase) console.log(`TV phase: ${(lastPhase = v.phase)}${v.verdict ? ` → ${v.verdict.title.title}: ${v.verdict.reason}` : ''}`);
    const humans = v.voters.filter(x => !x.nickname.startsWith('Bot'));
    if (!started && v.phase === 'lobby' && humans.length >= 1 && humans.every(x => x.moodDone)) {
      started = true;
      console.log('starting round');
      tv.send(JSON.stringify({type: 'startRound', cmdId: id()}));
    }
  });
}

for (let b = 0; b < bots; b++) {
  const seat = await post(`/api/rooms/${room.roomCode}/seats`, {nickname: roomFlag ? NAMES[b % NAMES.length] : `Bot ${b + 1}`});
  console.log(`seated ${seat.nickname}`);
  const s = ws(base);
  let sentFor = ''; // round:card already voted, so a burst of views doesn't double-vote
  s.on('open', () => s.send(JSON.stringify({type: 'hello', roomCode: room.roomCode, role: 'voter', token: seat.seatToken})));
  s.on('message', d => {
    const m = JSON.parse(String(d));
    if (m.type === 'view' && m.view.phase === 'lobby' && !m.view.me.mood)
      s.send(JSON.stringify({type: 'setMood', cmdId: id(), chips: ['funny']}));
    if (m.type === 'view' && (m.view.phase === 'voting' || m.view.phase === 'suddenDeath')) {
      const ballot = m.view.me.ballot;
      const card = ballot?.votes.length ?? 0;
      const key = `${m.view.round.no}:${card}`;
      if (ballot && !ballot.finished && card < m.view.round.deck.length && sentFor !== key) {
        sentFor = key;
        // bots get slower the later they joined, so the scoreboard rows spread out
        const wait = delay * (1 + b * 0.6);
        const vote = () => s.send(JSON.stringify({type: 'vote', cmdId: id(), roundNo: m.view.round.no, cardIndex: card, value: card === 0 ? 'yes' : 'no'}));
        wait ? setTimeout(vote, wait) : vote();
      }
    }
  });
}
