# CouchConsensus

Ends the "what should we watch?" argument in under three minutes. The TV shows a QR code, everyone swipes yes or no on their own phone, and the TV announces one pick and where to stream it.

Built for the Fire TV track (Vega OS, React Native) with an AWS backend (Amazon Bedrock, ECS Fargate, DynamoDB, CloudFront).

- Requirements: [CouchConsensus Requirements.md](CouchConsensus%20Requirements.md)
- Architecture: [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) · [ADRs](docs/architecture/adr/README.md) · [Data model](docs/architecture/DATA_MODEL.md)
- Day-1 platform checks: [spikes/RESULTS.md](spikes/RESULTS.md)
- Friction log: [FRICTION_LOG.md](FRICTION_LOG.md)
- Design: [design/README.md](design/README.md)

## Repository layout

```
apps/
  tv/        React Native for Vega app (Home, Lobby, Scoreboard, Verdict)
  phone/     Vite + Preact page opened from the QR code
  server/    Fastify session service: rooms, votes, timer, referee
packages/
  protocol/  Zod schemas + types for every message (shared by all three apps)
  referee/   Pure ranking engine (no I/O)
  catalog/   Catalog schema + demo deck of invented films
  theme/     Design tokens (colors, voter colors, fonts)
infra/       AWS CDK stack (DynamoDB, Fargate + ALB, CloudFront)
scripts/     Dev helpers
spikes/      Throwaway day-1 experiments (not part of the build)
```

## Prerequisites

- macOS on Apple Silicon, Node.js 22 (`.nvmrc`), pnpm 10 (`corepack enable`)
- Vega SDK 0.24 and the Vega Virtual Device ([install guide](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk.html)); then `source ~/vega/env`
- For deploys: AWS CLI with a profile for your account, Docker running

## Run locally

```bash
pnpm install
pnpm test                 # protocol, catalog, referee and server tests
pnpm build                # phone page + server bundle
pnpm start                # session service on :8080, serving the phone page at /r/<CODE>
```

For live reload instead: `pnpm dev` (server on :8080 with the phone page on Vite at :5173).

The QR code points at your Mac's LAN address, so phones must be on the same Wi-Fi.

### With Amazon Bedrock (AI moods and verdict line)

```bash
AWS_PROFILE=couch AI_MODE=on pnpm start
```

- **AI-1:** while the room is in the lobby, Claude Haiku 4.5 turns the moods into a 15-title shortlist from the rule-filtered catalog.
- **AI-2:** when a round ends, it writes the one-sentence verdict reason while the TV shows "The referee is thinking…".
- **Fallback (AI-3):** each call has a time budget (3 s for the deck, 2.5 s for the reason). A late, failed or off-spec answer falls back to the rule-based deck and template reason, so the game never waits on Bedrock.
- **Logs:** every outcome is logged as `ai deck: ai|fallback` or `ai reason: ai|fallback`, with latency and the reason for any fallback.
- **Privacy:** only aggregates go to the model. Nicknames are scrubbed from mood text, and individual votes are never sent.

### TV app on the Vega Virtual Device

```bash
source ~/vega/env
vega virtual-device start
pnpm tv:build             # writes apps/tv/src/server-url.ts (your LAN IP:8080), then builds
vega run-app apps/tv/build/aarch64-debug/tv_aarch64.vpkg
```

Press OK on **Start a room**. The lobby shows the QR code and room code; scan it with a phone to join.

To point the TV at a deployed backend: `SERVER_URL=https://<id>.cloudfront.net pnpm tv:build`.

## Deploy (AWS, us-east-1)

```bash
cd infra
AWS_PROFILE=couch npx cdk bootstrap      # once per account/region
AWS_PROFILE=couch pnpm deploy            # prints PublicUrl (CloudFront)
AWS_PROFILE=couch pnpm destroy           # tear everything down
```

Configuration (env vars on the service): `AI_MODE` (`off` default), `BEDROCK_MODEL_ID` (default `us.anthropic.claude-haiku-4-5-20251001-v1:0`), `AWS_REGION` (default `us-east-1`), `CATALOG_MODE` (`demo` default), `PUBLIC_BASE_URL`, `DEFAULT_REGION`.

## Licence

MIT. See [LICENSE](LICENSE).
