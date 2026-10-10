# ADR-0011: QR rendered on the TV with react-native-qrcode-svg; server PNG fallback

- Status: Accepted (S2 passed 2026-10-10: rendered on the VVD and scanned by a phone)
- Date: 2026-10-10

## Context

TV-2 requires a QR code plus a 4-letter room code. The requirements flagged "no QR library runs on Vega" as a risk.

## Decision

- Use **`@amazon-devices/react-native-qrcode-svg@3.0.0`** on top of the system-deployed **`@amazon-devices/react-native-svg`** (3.0). Both are on Amazon's supported-libraries list for Vega SDK 0.24, but `vega project install` skips the QR package ("not in OS version 1.2 profile"), so it is added with plain `npm install`.
- Encode `https://<host>/r/<CODE>` with error-correction level M, rendered at ≥ 360 px with a 4-module quiet zone, dark on white regardless of theme.
- Fallback: `GET /api/rooms/:code/qr.png` (server-side `qrcode` npm package) displayed with `<Image>`. Last resort: the large room code and a short URL, which the Join page also accepts.

## Consequences

- Lobby renders without an extra network round-trip, which helps the 2 s target.
