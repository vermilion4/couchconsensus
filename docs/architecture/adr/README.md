# Architecture Decision Records

Each ADR records one decision: the context, what we chose, what we rejected, and what it costs us. Format: lightweight [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions). An accepted ADR is never edited to change its decision; a new ADR supersedes it.

Statuses: **Accepted** (build on it), **Proposed** (recommended, needs the owner's sign-off or a spike result), **Superseded**.

| # | Decision | Status | Requirements |
| --- | --- | --- | --- |
| [0001](0001-server-authoritative-session.md) | Server-authoritative session service, thin clients | Accepted | SV-2, SV-3, SV-4, TV-4 |
| [0002](0002-session-service-hosting.md) | Single Node.js process on ECS Fargate behind ALB + CloudFront | Accepted | SV-2, AWS Builder |
| [0003](0003-room-state-and-persistence.md) | In-memory live state, DynamoDB snapshots with 24 h TTL | Accepted | SV-1, US-12, Privacy |
| [0004](0004-realtime-protocol.md) | WebSocket push of versioned, audience-projected snapshots; HTTPS polling fallback | Accepted | SV-2, US-7, US-11, US-12 |
| [0005](0005-phone-web-client.md) | Phone client is a Vite + Preact page served by the session service | Accepted | PH-1, PH-2 |
| [0006](0006-typescript-monorepo.md) | TypeScript monorepo with shared protocol and referee packages | Accepted | TV-1 |
| [0007](0007-deterministic-referee-engine.md) | Deterministic, pure referee engine; AI never decides | Accepted | SV-4, US-5, US-9 |
| [0008](0008-bedrock-ai-integration.md) | Bedrock: Claude Haiku 4.5, structured output, 2.5 s budget, rule-based fallback | Accepted | AI-1, AI-2, AI-3 |
| [0009](0009-title-catalog-and-region.md) | Demo deck by default; TMDB + JustWatch snapshot for real mode; region from CloudFront | Accepted | SV-5, SV-6, TV-5 |
| [0010](0010-identity-privacy-and-tokens.md) | Anonymous capability tokens, privacy by projection | Accepted | PH-1, PH-2, Privacy |
| [0011](0011-qr-code-rendering.md) | QR rendered on the TV with `react-native-qrcode-svg`; server PNG fallback | Accepted (spike S2) | TV-2 |
| [0012](0012-infrastructure-as-code.md) | AWS CDK (TypeScript) in `us-east-1` | Accepted | AWS Builder |
| [0013](0013-household-tiebreak-memory.md) | Household tie-break memory stores salted nickname hashes, not nicknames | Accepted | SV-7, Privacy |
