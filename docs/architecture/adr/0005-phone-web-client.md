# ADR-0005: Phone client is a Vite + Preact page served by the session service

- Status: Accepted
- Date: 2026-10-10

## Context

Voters must join from a QR code with no install and no account (PH-1), on current iOS Safari and Android Chrome, portrait, one-handed. The page must load quickly on cellular, because load time eats the 3-minute budget. It must survive refresh and screen lock (PH-2).

## Decision

- A single-page app built with **Vite + Preact + TypeScript**, compiled to static files and served by the session service at `/r/:code` (same origin as the API and WebSocket).
- Swipe gestures with native **Pointer Events**; every swipe has tap-button equivalents (Yes, No, Veto, Super-yes, Undo) for accessibility and for the demo video.
- The seat token is kept in `localStorage` under `couch:seat:<roomCode>`, with an in-memory fallback when storage is blocked (private mode).
- Imports `@couch/protocol` for types and Zod schemas.
- Performance budget: ≤ 60 KB JS gzipped total, first render ≤ 1.5 s on "Fast 4G".
- Poster art for the demo deck is served as optimised WebP from the same origin.

## Alternatives considered

- **React + React DOM.** Fine, but ~45 KB heavier for no benefit here.
- **Next.js / SSR.** Needs its own runtime; nothing to server-render.
- **Separate S3 + CloudFront origin for static files.** Cleaner at scale, but two origins means CORS and two deploys. Can be split later.
- **Native apps / App Clips / Instant Apps.** Out of scope per requirements.

## Consequences

- No app store, no install. The QR encodes `https://<cloudfront-host>/r/ABCD`.
- Phone and server deploy together (one image), so protocol versions cannot drift.
