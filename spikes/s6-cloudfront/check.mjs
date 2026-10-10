// Spike S6: WebSocket through CloudFront → ALB → Fargate.
// Usage: node spikes/s6-cloudfront/check.mjs https://dxxxx.cloudfront.net [holdSeconds]
import WebSocket from 'ws';

const base = (process.argv[2] ?? '').replace(/\/$/, '');
const holdSeconds = Number(process.argv[3] ?? 120);
if (!/^https?:\/\//.test(base)) {
  console.error('usage: check.mjs https://<distribution>.cloudfront.net|http://<alb> [holdSeconds]');
  process.exit(2);
}
const t0 = performance.now();
const ms = () => Math.round(performance.now() - t0);
const log = (...a) => console.log(String(ms()).padStart(6), 'ms ', ...a);

const health = await (await fetch(`${base}/healthz`)).json();
log('healthz', JSON.stringify(health));

const created = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({clientInstallId: 's6-check-0001'}),
});
const room = await created.json();
log('room', room.roomCode, 'joinUrl', room.joinUrl, 'region', room.region);

const page = await fetch(room.joinUrl);
log('phone page', page.status, page.headers.get('content-type'));

const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/ws`);
const rtts = [];
let welcomed = false;

ws.on('open', () => {
  log('wss open');
  ws.send(JSON.stringify({type: 'hello', roomCode: room.roomCode, role: 'host', token: room.hostToken}));
});
ws.on('message', data => {
  const m = JSON.parse(String(data));
  if (m.type === 'welcome') {
    welcomed = true;
    log('welcome', JSON.stringify(m));
    burst();
  } else if (m.type === 'pong') {
    rtts.push(Date.now() - m.t);
  } else log('message', String(data).slice(0, 200));
});
ws.on('close', (code, reason) => log('closed', code, String(reason)));
ws.on('error', e => log('error', e.message));

async function burst() {
  for (let i = 0; i < 20; i++) {
    ws.send(JSON.stringify({type: 'ping', t: Date.now()}));
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 1000));
  const s = [...rtts].sort((a, b) => a - b);
  log(`rtt over ${s.length} pings: p50 ${s[Math.floor(s.length / 2)]} ms, max ${s[s.length - 1]} ms`);
  // hold the socket open with 25 s keep-alives (ARCHITECTURE: client ping every 25 s)
  const until = Date.now() + holdSeconds * 1000;
  while (Date.now() < until && ws.readyState === WebSocket.OPEN) {
    await new Promise(r => setTimeout(r, 25_000));
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({type: 'ping', t: Date.now()}));
  }
  const held = ws.readyState === WebSocket.OPEN;
  log(held ? `PASS: socket held ${holdSeconds}s` : 'FAIL: socket dropped during hold');
  ws.close();
  process.exitCode = welcomed && held ? 0 : 1;
}
