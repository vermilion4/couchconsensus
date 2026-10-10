# ADR-0002: Single Node.js process on ECS Fargate behind ALB + CloudFront

- Status: Accepted
- Date: 2026-10-10

## Context

The service must hold ~9 WebSockets per room, run a 90-second timer per round, serialise commands per room, and push to everyone in < 1 s. It must be hosted on AWS (AWS Builder mini challenge) and reachable over HTTPS/WSS from phones on any network. The team is one builder with 13 days.

## Decision

Run the session service as **one long-lived Node.js 24 process** (Fastify 5 + `@fastify/websocket`) in a container on **Amazon ECS Fargate (desired count 1)** behind an **Application Load Balancer**, fronted by **Amazon CloudFront**.

- CloudFront supplies TLS on a free `*.cloudfront.net` hostname (no domain or certificate purchase), passes WebSocket upgrades through, and adds the `CloudFront-Viewer-Country` header (ADR-0009).
- ALB gives Fargate a stable origin DNS name and health checks; idle timeout raised to 300 s; clients ping every 25 s.
- Same container serves the phone page's static files, the REST API and the WebSocket. One origin, no CORS.

## Alternatives considered

| Option | Why not |
| --- | --- |
| API Gateway WebSocket API + Lambda + DynamoDB | Every command becomes a cold-startable Lambda that must load state, lock the room, and fan out via `PostToConnection`. The 90 s timer needs EventBridge Scheduler or Step Functions. Roughly 3× the moving parts for the same demo. A good scale story, the wrong trade for 13 days. |
| AWS App Runner | No WebSocket support. |
| AWS AppSync Events | Good pub/sub, but the referee logic and timer still need compute somewhere; adds a second realtime model. |
| EC2 instance + Caddy | Cheapest and simplest, but needs a domain for TLS and hand-managed patching. Kept as an emergency fallback. |
| Lightsail containers | Viable, but less "AWS-native" for the Builder write-up and weaker IaC story. |

## Consequences

- Positive: timers are `setTimeout`, fan-out is a loop, per-room serialisation is an in-process queue. Local dev is `node` with no emulators.
- Negative: no horizontal scale; a deploy drops sockets for a few seconds (clients auto-reconnect, rooms rehydrate). Accepted for a hackathon; scale-out would need room-code sticky routing.
- Cost: ALB (~$0.55/day) + Fargate 0.5 vCPU/1 GB (~$0.60/day) + CloudFront/DynamoDB (pennies). Under $20 for the event.
- Spike S6 confirms CloudFront WebSocket passthrough on day 1.
