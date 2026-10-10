# Day-1 risk checks: results

Oct 10, 2026 · Vega SDK 0.24.12112 · Vega CLI 1.4.4 · VVD "OS 1.2 (TV Ship/102282480)", aarch64 · MacBook M4 Pro

Plan and pass conditions: [ARCHITECTURE.md §11](../docs/architecture/ARCHITECTURE.md#11-day-12-spikes-before-feature-work). Friction found along the way: [FRICTION_LOG.md](../FRICTION_LOG.md) rows 3–11.

| Spike | Status | Evidence | Design consequence |
| --- | --- | --- | --- |
| **S1** WebSocket on VVD | ✅ Pass on LAN · ⏳ `wss://` via CloudFront pending S6 | Socket opened to `ws://10.77.160.212:8787/ws`; echo RTT 3 ms; 1 tick/s received steadily (30/60/90… reports); `fetch` also works | WebSocket stays the primary transport. Polling fallback kept but not needed for v1. The VVD reaches the Mac via its LAN IP (QEMU's `10.0.2.2` not needed) |
| **S2** QR on VVD | ✅ Pass | `@amazon-devices/react-native-qrcode-svg@3.0.0` renders 360 px, ECL M; a phone camera scanned it off the VVD window and opened the URL (server logged `GET /healthz?from=qr` from the phone at 16:20 UTC) | Install with plain npm (not in `vega project install` profile). Server PNG fallback not needed unless the scan fails |
| **S3** Bedrock access | ⛔ Blocked (account) | Company account: Haiku 4.5 needs use-case form. Personal account: Bedrock `NOT_AUTHORIZED` for every model, form rejected; card added, waiting for activation | Core tier ships with `AI_MODE=off`. Correct client for Haiku 4.5 is `AnthropicBedrock` (legacy InvokeModel) with inference profile `us.anthropic.claude-haiku-4-5-20251001-v1:0`. Fallback model: Amazon Nova Lite |
| **S4** Monorepo + Metro | ✅ Pass | TV app imported `@couch/protocol` (Zod 4) from a pnpm workspace; on device: valid vote accepted, invalid rejected with 4 issues | pnpm with `node-linker=hoisted`; Metro `watchFolders` + `nodeModulesPaths` on the workspace root; Babel `plugin-transform-export-namespace-from` |
| **S5** Sound on VVD | ✅ Pass (with constraint) | URL playback fails (code 4) for mp3/m4a/wav; MP3 via MSE fails (code 3); **AAC `.m4a` via MediaSource plays to `ended`** | Whistle/coin sounds as AAC `.m4a`, fetched in JS and played through `MediaSource` (`@amazon-devices/react-native-w3cmedia`). Manifest needs the media `[wants]` services |
| **S6** CloudFront WebSocket | ⏳ Waiting on personal AWS account activation | — | — |

## Observation: apps closed after ~18 min idle

Both test apps lost their sockets (close 1006) at 16:13 UTC, ~18 min after the last remote input, and were no longer running; the VVD itself stayed up. Most likely the idle/screensaver path closing foreground apps. Consequences:
- Keep the room-restore path (host token → resume room) as designed; it is the safety net.
- Before building the lobby, look for a Vega keep-screen-awake API and hold it while the lobby or a round is active.

## Reusable bits

- `tvspike/` – Vega app with the WebSocket client, QR, and the working MSE audio path (`play('m4a', 'mse')` in `src/App.tsx`).
- `tv-test-server/` – WebSocket echo + ticker and audio file server (`node server.mjs`, port 8787).
- `s4-monorepo/` – working pnpm workspace + Metro + Babel config for the real scaffold.
- `s3-bedrock/` – latency/validity harness for AI-1/AI-2 (`AWS_PROFILE=couch npm start`), rerun once Bedrock is authorised.

## Driving the VVD from a script

- Remote: `vega device run-cmd --command 'inputd-cli button_press KEY_ENTER'` (`KEY_UP/DOWN/LEFT/RIGHT/BACK` too).
- Logs from the app: send them to the test server over the socket; screenshots from the CLI don't work (friction #9).
