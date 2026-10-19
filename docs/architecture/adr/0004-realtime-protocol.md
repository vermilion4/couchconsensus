# ADR-0004: WebSocket push of versioned, audience-projected snapshots; HTTPS polling fallback

- Status: Accepted
- Date: 2026-10-10

## Context

Every client must reflect changes within 1 s (SV-2). Clients reconnect often (phone locks, Wi-Fi switches). The TV must never receive vote values (TV-4). Vega's WebSocket support is documented only as "pure JS, likely to work", so a fallback is required.

## Decision

1. **Commands up, snapshots down.** Clients send typed commands; the server replies with full **projections** of the room for that client's audience (`TvView` or `VoterView`), not diffs. Snapshots are small (< 4 KB), and full snapshots make reconnect and late join trivially correct.
2. **Versioning.** Each room has a monotonically increasing `rev`. Every projection carries `rev` and `serverNow`. Clients drop any snapshot with `rev` ≤ the last one rendered.
3. **Idempotency.** Every command carries a client-generated `cmdId` (UUID). The server remembers the last 64 `cmdId`s per seat and acknowledges duplicates without re-applying. Phones resend unacknowledged commands after reconnect.
4. **Acks.** Each command gets `{type:"ack", cmdId, ok: true, rev}` or `{type:"nack", cmdId, ok: false, error, message}` so the phone can show "vote saved" and roll back optimistic UI on rejection.
5. **Time.** The server owns `endsAt` (epoch ms). Clients compute `offset = serverNow − Date.now()` from each snapshot and render the countdown locally.
6. **Heartbeat.** Client ping every 25 s; server considers a socket dead after 60 s without traffic. Connection status feeds the "connected" dot on the TV.
7. **Fallback transport.** `GET /api/rooms/:code/view?since=<rev>` (returns 204 if unchanged) and `POST /api/rooms/:code/commands` run the same handlers and projections. The TV switches to 1 s polling if spike S1 fails or after 3 failed socket attempts.

Schemas: [DATA_MODEL.md §5](../DATA_MODEL.md#5-wire-protocol).

## Alternatives considered

- **JSON Patch diffs.** Less bandwidth, more bugs (missed patch → divergent state). Not worth it at < 4 KB.
- **Server-Sent Events + POST.** Works on Vega via fetch streaming only if supported; WebSocket is the better-known path. SSE remains a possible third transport.
- **Socket.IO.** Adds a protocol and a client library that would need to run on Vega. Plain `WebSocket` is the smaller bet.

## Consequences

- One projection function per audience is the privacy boundary and gets dedicated tests.
- Polling fallback keeps a 1 s worst-case lag, which still meets SV-2 for the TV.

## Update (2026-10-19): the HTTP fallback is required on Vega

- **Finding:** on the Vega Virtual Device, some WebSocket text frames reach JavaScript garbled.
  - It happens reliably for a 3.1 KB coin-toss verdict, and intermittently for ~1.5 KB frames sent right after another frame.
  - It fits frames that span TCP segments (FRICTION_LOG #17).
- **Fix:** the fallback endpoint is now implemented: `GET /api/rooms/:code/view` with `Authorization: Bearer <host or seat token>`.
  - `RoomClient` calls it when a message is unreadable or invalid, or when an `ack`'s `rev` stays ahead of the last view for 1.5 s.
  - If HTTP is no newer either, it reconnects; the server sends the current view on attach.
- **Verified on the device:** a sudden-death round ending in a five-way coin toss used the HTTP path twice and reached the verdict without freezing.

