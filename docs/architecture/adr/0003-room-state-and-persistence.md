# ADR-0003: In-memory live state, DynamoDB snapshots with 24 h TTL

- Status: Accepted
- Date: 2026-10-10

## Context

SV-1 requires rooms to expire after 24 hours. US-12 and the resilience NFR require the TV to restore the room after a reconnect. SV-2 requires < 1 s propagation, so storage latency must stay off the hot path. A room's full state is small (8 voters × ≤ 20 cards ≈ a few KB).

## Decision

- Live rooms live in memory in `RoomManager` (one `Room` object per code).
- After each mutating command, the room's **whole document** is written to DynamoDB table `couch-rooms` as one item (`PK = ROOM#<code>`, `SK = STATE`). Writes are **coalesced per room** (at most one in flight, latest wins, ≤ 250 ms delay) and **forced** on phase transitions.
- Writes are conditional on `rev` (optimistic concurrency) to catch a stale writer after a redeploy.
- Item carries `ttl = createdAt + 24 h` (epoch seconds). DynamoDB deletes expired items within ~48 h, so the service **also** treats `expiresAt < now` as "room not found" on every read.
- On a command or connection for a code not in memory, the service rehydrates the room from DynamoDB.
- Room code allocation uses `PutItem` with `attribute_not_exists(PK)`; retry on collision.

## Alternatives considered

- **DynamoDB as the live store (read-modify-write per command).** Adds 10–30 ms + contention per vote; needed only with multiple instances. Rejected for v1.
- **Item-per-vote single-table design.** Better for analytics, worse for atomic snapshots and rehydrate. Not needed: room documents are far below the 400 KB item limit.
- **No persistence.** Fails "TV restores the room" across a service restart.

## Consequences

- One table, one item type for rooms (plus the optional household record, DATA_MODEL §4.3). On-demand billing.
- A crash can lose ≤ 250 ms of votes. Acceptable; affected phones re-send unacknowledged commands on reconnect (idempotent via `cmdId`).
- Privacy: votes exist only in that item and in memory, and both die within 24 h.
