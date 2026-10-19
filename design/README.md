# CouchConsensus design

Oct 10, 2026. Figma file **Couch Consensus** has three pages (Starter plan limit): **Foundations** (cover thumbnail, colors, type), **Logos**, **Screens** (main flow plus a States row).

## Brand

- **Logo: The Couch** (Figma Logos page, option 1). Three people on one sofa in voter colours (teal, glow, violet); the sofa is Fire TV orange with Ember cushions. Wordmark in Bricolage Grotesque ExtraBold. Replaced the earlier Swipe Stack mark on Oct 19.
- **Source of truth: [`brand/build_logo.py`](brand/build_logo.py).** It writes clean SVGs with every glyph converted to outlines (kerned with HarfBuzz), so no font is needed to display them. [`brand/render.mjs`](brand/render.mjs) renders the PNGs.

| File | Use |
| --- | --- |
| `brand/svg/mark.svg` | The couch mark alone, transparent |
| `brand/svg/mark-mono-glow.svg`, `mark-mono-orange.svg` | One-colour versions (seams and head outlines cut out) for tiny or single-colour use |
| `brand/svg/app-icon.svg` → `png/app-icon-512.png` | App icon; copied to `apps/tv/assets/image/icon.png` (Vega manifest needs 512×512 PNG) |
| `brand/svg/tv-tile.svg` → `png/tv-tile-1280.png` | Fire TV launcher tile, 1280×720, no transparency, lockup inside the 882×448 safe area |
| `brand/svg/lockup-horizontal.svg` | Mark + wordmark, for dark backgrounds |
| `brand/svg/logo-stacked.svg` | Mark over wordmark, square |

Regenerate after any change:

```bash
python3 -m venv .venv && .venv/bin/pip install uharfbuzz fonttools
.venv/bin/python design/brand/build_logo.py
node design/brand/render.mjs
```

- Fire TV orange is used as a color only. No Amazon or Fire TV logos or wordmarks appear anywhere (hackathon video rules).

## Fonts

[`fonts/`](fonts) holds Bricolage Grotesque and Figtree (SIL Open Font License, files and licences from the google/fonts repository), plus static instances in `fonts/static/` (Bricolage ExtraBold/Bold, Figtree Regular/Medium/SemiBold/Bold) for the logo build and for bundling into the apps.

## Tokens

Code: [`packages/theme`](../packages/theme/src/index.ts). Figma: paint and text styles on every page.

| Token | Hex | Use |
| --- | --- | --- |
| Fire Orange | `#FC4C02` | Focus, primary action, the winner. Text on it is always Night (5.3:1). |
| Ember | `#FF8A4C` | Small orange text on Night (7.7:1). |
| Night | `#0E1626` | Background. |
| Couch | `#1A2740` | Panels, unfocused buttons. |
| Cushion | `#25365A` | Tracks, chips. |
| Glow | `#F7F1E8` | Primary text (16.1:1). |
| Mist | `#9AA8BF` | Secondary text (7.5:1). |
| Voter colors | teal, violet, lime, sky, pink, gold, mint, chalk | One per person, kept all session on TV and phone. All ≥ 6.5:1 on Night. |

Type: **Bricolage Grotesque** ExtraBold for display (room code, titles, countdown), **Figtree** for everything else. TV: 160 / 96 / 56 / 34 / 28, smallest 28 px at 1080p. Phone: 34 / 24 / 17 / 15.

## Principles

1. **The room is the hero.** People appear as colored head-and-shoulder silhouettes along the bottom of the TV, and each person keeps their color everywhere.
2. **One loud thing per screen.** Home: the question. Lobby: the room code tiles. Scoreboard: the countdown with referee stripes. Verdict: the title. Phone: the card.
3. **Orange means "this one".** Focus, the main action, and the winner. Nothing decorative is orange.
4. **Privacy is visible.** The scoreboard shows progress bars, never votes, and says so.

## Screens

| TV (1920×1080) | Phone (390×844) |
| --- | --- |
| [Home](previews/tv-home.png) | [Join](previews/ph-join.png) |
| [Lobby](previews/tv-lobby.png) | [Mood](previews/ph-mood.png) |
| [Scoreboard](previews/tv-scoreboard.png) | [Swipe](previews/ph-swipe.png) |
| [Verdict](previews/tv-verdict.png) | [Waiting](previews/ph-waiting.png) |
| | [Result](previews/ph-result.png) |

States:

| TV | Phone |
| --- | --- |
| [Ground rules editor](previews/tv-rules.png) (TV-7) | [Sudden death swipe](previews/ph-sudden-death.png) |
| [Sudden death scoreboard](previews/tv-sudden-death.png) | [Reconnecting](previews/ph-reconnecting.png) |
| [Coin toss](previews/tv-coin-toss.png) (TV-8) | [Room not found](previews/ph-room-not-found.png) |
| [Resume room](previews/tv-resume.png) (US-12) | [Room full](previews/ph-room-full.png) |

Foundations board: [previews/foundations.png](previews/foundations.png). Figma cover: [previews/cover.png](previews/cover.png).

## Open items

- Bundle the static fonts into the TV app (Vega font loading not yet tested) and self-host them for the phone page; both still fall back to system fonts.
- Figma cover: right-click the "Cover (thumbnail)" frame on Foundations → **Set as thumbnail** (the plugin API cannot set it).
- Poster art for the 60-title demo deck: same style as "Pancake Heist", "Orbit of Small Things" and "Second Serve" (flat shapes, one idea per poster, no real titles or artwork).
