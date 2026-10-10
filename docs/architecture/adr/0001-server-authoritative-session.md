# ADR-0001: Server-authoritative session service, thin clients

- Status: Accepted
- Date: 2026-10-10

## Context

Up to 9 devices (1 TV, 8 phones) must agree on one room state within 1 s (SV-2). Votes must stay private from the TV and from other voters (TV-4, Privacy). Late joiners and reconnecting phones must pick up exactly where they should (US-11, US-12). The round ends on any of three triggers (SV-3), and only one of them may win.

## Decision

The session service is the single source of truth. It owns rooms, seats, decks, votes, the timer and the referee. Clients send **commands** (intent, e.g. "vote yes on card 4") and receive **projections** (state built for their audience). Clients hold no authoritative state beyond their capability token.

## Alternatives considered

- **TV as host (TV runs the game, phones connect to the TV).** Phones would need to reach the TV on the LAN (client isolation, no inbound sockets on the VVD, cellular phones excluded) and the TV would see every vote. Rejected.
- **Peer-to-peer / CRDT shared state.** Overkill; makes privacy and "exactly one round end" hard. Rejected.

## Consequences

- Positive: privacy enforced in one place; reconnect = resend snapshot; referee testable server-side.
- Negative: the service is a single point of failure for a session. Mitigated by DynamoDB snapshots (ADR-0003) and fast reconnect.
- The TV app does not need any Fire TV-specific API, which suits the VVD's limits.
