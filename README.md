# CouchConsensus

Ends the "what should we watch?" argument in under three minutes. The TV shows a QR code, everyone votes on their own phone, and the TV announces one pick, why it won, and where to stream it.

Built for the Fire TV track (Vega OS, React Native for Vega) and the AWS Builder challenge: Claude Haiku 4.5 on Amazon Bedrock for the AI features, and an AWS CDK stack for ECS Fargate, CloudFront and DynamoDB. The AWS account was still awaiting activation at submission time.

https://github.com/user-attachments/assets/3f6ea746-daf1-4a40-a929-ce7abc92ea9e

## What it does

1. **Start a room on the TV.** One press shows a QR code and a 4-letter room code. No app or account is needed on the phones.
2. **Join from any phone.** Scan, type a nickname, and optionally pick a mood (funny, cozy, scary…). Each person's head appears on the TV in their own colour.
3. **Set ground rules with the remote.** Which streaming services you have, and the longest movie you'll sit through. Every card in the deck obeys them.
4. **Swipe 15 cards in 90 seconds.** Yes, no, one veto and one super-yes per round, with undo. Everyone sees the same deck.
5. **Watch progress, not votes.** The TV shows a countdown and how far each person has got, never how anyone voted. The host can call it early.
6. **Get exactly one pick.** The TV blows the referee's whistle and shows the winner, a one-sentence reason and where to watch it. Runner-up and Rematch are one press away. If nothing got a yes, five new cards go to sudden death; a dead heat is settled by a coin toss on screen.

## How it works

- **The referee is plain rules, not AI.** A vetoed title can't win. Titles everyone said yes to rank first, then more points (yes = 1, super-yes = 2), then fewer no votes, then a seeded coin toss. The engine is a pure function, tested with property-based tests ([ADR-0007](docs/architecture/adr/0007-deterministic-referee-engine.md)).
- **AI shapes the deck and words the verdict.** Claude Haiku 4.5 on Amazon Bedrock turns the room's moods into a shortlist, and writes the one-line reason from aggregate counts only. Each call has a time budget. Anything late or off-spec falls back to the rule-based deck and a template reason, so the game never waits on AI ([ADR-0008](docs/architecture/adr/0008-bedrock-ai-integration.md)).
- **The server owns the room.** A Fastify service holds every room and pushes each screen its own projection over WebSockets: the TV never receives a vote value, and each phone sees only its own ballot. Commands are idempotent, every view carries a `rev`, and clients recover a lost or garbled view over HTTP ([ADR-0001](docs/architecture/adr/0001-server-authoritative-session.md), [ADR-0004](docs/architecture/adr/0004-realtime-protocol.md)).
- **Three clients, one protocol.** The TV app (React Native for Vega), the phone page (Preact, opened from the QR code) and the server share Zod schemas from `packages/protocol`.
- **Demo mode stays clear of trademarks.** 60 invented films on posters built from CC0 / public-domain photos ([credits](packages/catalog/art/CREDITS.md)), invented service names and synthesized sounds, so the demo contains no third-party trademarks, posters or music.

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

| To run | You need |
| --- | --- |
| Server, phone page and tests | Node.js 22+ (`.nvmrc`) and pnpm 10 (`corepack enable` picks the pinned version). Any OS. |
| The TV app | The [Vega SDK 0.24](https://developer.amazon.com/docs/vega/0.24/install-vega-sdk.html) with the Vega Virtual Device. Amazon's install guide covers **macOS** (Rosetta 2 on Apple Silicon) and **Ubuntu** (KVM); Windows isn't covered. Developed and tested on macOS (Apple Silicon). |
| Phones | Any phone with a browser, on the same Wi-Fi as the computer running the server. |
| AI mode (optional) | An AWS account with Amazon Bedrock access to Claude Haiku 4.5 in us-east-1, and credentials in an AWS CLI profile. Without it, the game runs on its rule-based fallback. |
| Deploying (optional) | An AWS CLI profile and Docker running (the server image is built locally). |

## Run locally

```bash
pnpm install
pnpm test                 # protocol, catalog, referee, server and TV logic tests
pnpm build                # phone page + server bundle
pnpm start                # session service on :8080, serving the phone page at /r/<CODE>
```

For live reload instead: `pnpm dev` (server on :8080 with the phone page on Vite at :5173).

The QR code points at your computer's LAN address, so phones must be on the same Wi-Fi. If a firewall prompt appears, allow incoming connections for Node.

**No TV or spare phones?** `node scripts/demo-bots.mjs http://localhost:8080 3` plays the TV and three extra voters. It prints a join URL for your own phone, starts the round once you've joined, and the bots vote alongside you. To fill a room the real TV app created: `node scripts/demo-bots.mjs http://localhost:8080 3 --room <CODE>`.

### With Amazon Bedrock (AI moods and verdict line)

```bash
AWS_PROFILE=<your-profile> AI_MODE=on pnpm start
```

- **AI-1:** while the room is in the lobby, Claude Haiku 4.5 turns the moods into a 15-title shortlist from the rule-filtered catalog.
- **AI-2:** when a round ends, it writes the one-sentence verdict reason while the TV shows "The referee is thinking…".
- **Fallback (AI-3):** each call has a time budget (3 s for the deck, 2.5 s for the reason). A late, failed or off-spec answer falls back to the rule-based deck and template reason, so the game never waits on Bedrock.
- **Logs:** every outcome is logged as `ai deck: ai|fallback` or `ai reason: ai|fallback`, with latency and the reason for any fallback.
- **Privacy:** only aggregates go to the model. Nicknames are scrubbed from mood text, and individual votes are never sent.

### TV app on the Vega Virtual Device

Start the server first (`pnpm start`), then in a second terminal:

```bash
source ~/vega/env         # added by the Vega SDK installer
vega virtual-device start
pnpm tv:build             # writes apps/tv/src/server-url.ts (your LAN IP:8080), then builds
vega run-app apps/tv/build/aarch64-debug/tv_aarch64.vpkg
```

Use the package that matches the Virtual Device's CPU: `aarch64-debug/tv_aarch64.vpkg` on Apple Silicon, `x86_64-debug/tv_x86_64.vpkg` on x86_64 machines (e.g. Ubuntu).

Press OK on **Start a room**. The lobby shows the QR code and room code; scan it with a phone to join.

To point the TV at a deployed backend: `SERVER_URL=https://<id>.cloudfront.net pnpm tv:build`.

## Deploy (AWS, us-east-1)

```bash
cd infra
AWS_PROFILE=<your-profile> npx cdk bootstrap      # once per account/region
AWS_PROFILE=<your-profile> pnpm run deploy        # prints PublicUrl (CloudFront)
AWS_PROFILE=<your-profile> pnpm run destroy       # tear everything down
```

Use `pnpm run deploy`, not `pnpm deploy`: the latter is a built-in pnpm command.

Configuration (env vars on the service): `AI_MODE` (`off` default), `BEDROCK_MODEL_ID` (default `us.anthropic.claude-haiku-4-5-20251001-v1:0`), `AWS_REGION` (default `us-east-1`), `CATALOG_MODE` (`demo` default), `PUBLIC_BASE_URL`, `DEFAULT_REGION`.

## Licence

MIT. See [LICENSE](LICENSE).
