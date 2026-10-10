# ADR-0013: Household tie-break memory stores salted nickname hashes, not nicknames

- Status: Accepted (owner confirmed 2026-10-10)
- Date: 2026-10-10

## Context

SV-7 (Could): remember whose super-yes won last time, to break future ties. Memory has to outlive a room (rooms are deleted after 24 h), and there are no accounts, so the only stable identifiers are the TV's install and the voter's nickname. The privacy NFR says only a nickname is stored and room data is deleted after 24 hours. Keeping plain nicknames for weeks would stretch that promise.

## Decision

- One DynamoDB item per TV install: `PK = HOUSEHOLD#<clientInstallId>`, `SK = MEMORY`, TTL **30 days**, refreshed on each write.
- The item never contains a nickname. It holds a per-household random `salt` and `nicknameHash = HMAC-SHA256(pepper, salt + normalise(nickname))`.
  - `normalise` = trim, lower-case, Unicode NFKC, so "Sam" and " sam" match.
  - `pepper` is a 32-byte server secret in SSM Parameter Store (`/couch/household-pepper`), never in DynamoDB or the image. A table dump alone cannot be brute-forced against a nickname dictionary.
- **Write:** when a round's winner received at least one super-yes, record the hash of the last such voter (join order) and the time.
- **Read:** at tally, the server hashes each voter's nickname with the household salt and passes `priorSuperYesWinner` to the referee engine. The engine uses it as the last tie-breaker **before** the coin toss: if exactly one tied title got a super-yes from that voter, it wins. Otherwise, coin toss as before.
- The TV's About screen states: "To break ties, this TV remembers a scrambled code for the last super-yes winner for 30 days. No names are stored."

## Alternatives considered

- **Store nicknames in plain text.** Simplest; conflicts with the spirit of the 24 h privacy rule. Rejected.
- **Drop SV-7.** Valid (it's a Could), but the feature adds personality at low cost.
- **Plain SHA-256 without pepper.** Nicknames are short and guessable; an unpeppered hash is reversible with a dictionary.

## Consequences

- Nickname changes ("Sam" → "Sammy") break the link. Accepted: it's a tie-breaker, not an identity.
- Two people in different rooms on the same TV with the same nickname are treated as the same person. Accepted.
- Rotating the pepper silently resets all household memories.
- Referee engine stays pure: it receives a `VoterId`, never a hash or a secret.
