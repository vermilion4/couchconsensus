// Spike test server for S1 (WebSocket on the VVD) and S5 (sound).
// Serves /whistle.{mp3,m4a,wav}, /healthz, and a WebSocket at /ws that
// sends a tick every second and echoes anything it receives.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 8787);
const TYPES = { mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav" };
const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);

const server = http.createServer(async (req, res) => {
  log("HTTP", req.method, req.url, "from", req.socket.remoteAddress);
  if (req.url?.split("?")[0] === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, serverNow: Date.now() }));
  }
  const m = req.url?.match(/^\/whistle\.(mp3|m4a|wav)$/);
  if (m) {
    const body = await readFile(new URL(`./public/whistle.${m[1]}`, import.meta.url));
    res.writeHead(200, { "content-type": TYPES[m[1]], "content-length": body.length });
    return res.end(body);
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws, req) => {
  log("WS connect from", req.socket.remoteAddress);
  let seq = 0;
  const timer = setInterval(() => ws.send(JSON.stringify({ type: "tick", seq: ++seq, serverNow: Date.now() })), 1000);
  ws.on("message", (data) => {
    log("WS recv", String(data).slice(0, 200));
    ws.send(JSON.stringify({ type: "echo", data: String(data), serverNow: Date.now() }));
  });
  ws.on("close", (code) => { clearInterval(timer); log("WS close", code, "after", seq, "ticks"); });
});

server.listen(PORT, "0.0.0.0", () => log(`listening on :${PORT}`));
