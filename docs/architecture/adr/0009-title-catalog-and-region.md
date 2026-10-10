# ADR-0009: Demo deck by default; TMDB + JustWatch snapshot for real mode; region from CloudFront

- Status: Accepted (owner confirmed TMDB + JustWatch on 2026-10-10)
- Date: 2026-10-10

## Context

- SV-5: build the deck from a title catalog and the ground rules. SV-6 (Must): demo mode with no third-party posters, logos or service names.
- TV-5: the verdict shows where to watch.
- Open question: which title API for real mode? The owner suggested the Prime Video API.
- Open question: which country's availability? The owner wants it based on location.

Findings (Oct 2026):
- **Prime Video has no public catalog API.** Amazon's Prime Video APIs (e.g. the Avails API) are for content partners managing their own titles, not for reading the catalog.
- **TMDB** has the largest open movie database (~1M films), per-country watch-provider data sourced from **JustWatch**, and free API access for **non-commercial** use with attribution to TMDB and JustWatch.
- **Watchmode** free tier: 2,500 requests/month, up to 3 countries, non-commercial.
- **Streaming Availability API (Movie of the Night)**: ~60 countries, includes deep links (useful for TV-9 later), freemium via RapidAPI.

## Decision

**1. Catalog port with two implementations**, selected by `CATALOG_MODE=demo|real` (default `demo`).

- **Demo catalog** (`packages/catalog/demo-deck.json`): ~60 invented films with original placeholder art, invented services ("StreamCo", "FlixBox", "ReelHub"…), realistic runtimes and genres. Enough variety that rules and moods visibly change the deck. This is what the video shows.
- **Real catalog**: an **offline snapshot** built by `scripts/ingest-tmdb.ts` from TMDB (`/discover/movie` by popularity, `include_adult=false`) plus `/movie/{id}/watch/providers` for a fixed set of regions (start: US, GB, CA, IN, DE, AU). Stored as JSON in the image. No live API calls during a session, so no rate limits or latency on the hot path, and refreshable weekly.

**2. Region for "where to watch":**
1. Default = `CloudFront-Viewer-Country` of the TV's room-create request.
2. Host can override it in the ground-rules editor (TV-7).
3. If the country is not in the snapshot, fall back to `US` and show "availability for US".
Demo mode ignores region (invented services).

**3. Attribution.** In real mode, an About screen on the TV carries the TMDB logo + notice and "Streaming data by JustWatch".

## Alternatives considered

- **Prime Video API**: does not exist publicly.
- **Watchmode**: 3-country cap on the free plan.
- **Streaming Availability API**: strongest for deep links and country coverage; good choice if TV-9 ever becomes demonstrable on real hardware. Second choice.
- **Live API calls per deck**: latency, quotas, and failure modes in the middle of a round.
- **Region from phone geolocation**: requires a permission prompt on every phone; the room is in one place, so the TV's location is the right signal.
- **Region from Vega device locale**: locale ≠ storefront country, and the VVD reports the Mac's settings. Kept as a tie-breaker if CloudFront country is missing.

## Consequences

- The hackathon entry is non-commercial; confirm TMDB terms at sign-up and record it in the friction log.
- Real mode is "If time allows" in the plan; the architecture keeps it a data-file swap.
