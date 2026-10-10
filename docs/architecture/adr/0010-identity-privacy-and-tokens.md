# ADR-0010: Anonymous capability tokens, privacy by projection

- Status: Accepted
- Date: 2026-10-10

## Context

No accounts on phones (PH-1). A voter must return to the same seat after refresh or lock (PH-2, US-12). Only the host's TV may start, end, run-up or rematch. Privacy NFR: nickname only, data deleted after 24 h, individual votes never displayed.

## Decision

- **Host token**: 256-bit random, returned once to the TV on `POST /api/rooms`. Stored on the TV (AsyncStorage/MMKV) with the room code. Required for host commands.
- **Seat token**: 256-bit random, returned to a phone on `POST /api/rooms/:code/seats`. Stored in `localStorage`. Identifies the voter's seat for reconnects and commands.
- The server stores only **SHA-256 hashes** of tokens in the room document; a DynamoDB leak cannot be replayed.
- Tokens travel in the WebSocket `hello` message or an `Authorization: Bearer` header, **never in URLs** (the QR URL carries only the room code).
- **Room code**: 4 letters from the 20-letter alphabet `ABCDEFGHJKMNPQRTUWXY` (drops I, L, O, S, V, Z, which are easy to misread) → 20^4 = 160,000 codes. Generated codes are checked against a small blocklist of offensive words. Join attempts are rate-limited per IP (10/min) to stop code scanning; rooms are short-lived anyway.
- **Nicknames**: trimmed, 1–12 characters, control and zero-width characters stripped, de-duplicated in a room by suffixing ("Sam", "Sam 2"). A small blocklist filter applies.
- **Privacy by projection**: the TV view contains per-voter progress (`done/total`, `finished`, `connected`) and never vote values. A voter view contains only that voter's own votes. The verdict exposes aggregates; the phone's Result screen shows *my* vote on the winner.
- No IP addresses or user agents are stored in DynamoDB; access logs keep IPs for 7 days in CloudWatch for abuse handling.

## Consequences

- Anyone with the QR code can join the room. That is the design (it's a living room); the host can remove a seat from the lobby (`kickVoter`, Should).
- Losing `localStorage` (private tab closed) means rejoining as a new seat; the old seat goes idle and never blocks (ADR-0004 activity window).
