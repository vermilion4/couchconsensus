# ADR-0008: Bedrock with Claude Haiku 4.5, structured output, strict time budget, rule-based fallback

- Status: Accepted (owner confirmed Haiku 4.5 on 2026-10-10; model ID still to be verified in spike S3)
- Date: 2026-10-10

## Context

- AI-1 (Should): turn the room's moods into catalog filters and a shortlist.
- AI-2 (Should): write the one-sentence verdict reason from the tally.
- AI-3 (Must): if Bedrock takes over 3 s or fails, use a rule-based deck and a template reason.
- At least one of AI-1/AI-2 must ship for the AWS Builder mini challenge.
- Open question from the requirements: which Bedrock model? Resolved: start with Haiku 4.5.

Both tasks are short, structured and latency-bound. Neither needs deep reasoning. The verdict must appear within 3 s of round end, so the model call must finish well inside that.

## Decision

**Model.** Claude **Haiku 4.5** on Amazon Bedrock in `us-east-1` for both tasks. It is Anthropic's fastest current model, supports structured outputs on Bedrock, and is inexpensive ($1 / $5 per million tokens first-party; Bedrock pricing applies). Model ID and inference profile are confirmed in the Bedrock console during spike S3 and stored in config (`BEDROCK_MODEL_ID`), not code.

Upgrade path if output quality disappoints in testing: **Claude Sonnet 5.5**, same code, config change only, provided p95 latency stays under the budget.

**Client.** Anthropic's TypeScript Bedrock SDK (`@anthropic-ai/bedrock-sdk`), default export `AnthropicBedrock` (`awsRegion: "us-east-1"`), authenticated by the Fargate task role. Haiku 4.5 is served through Bedrock's InvokeModel path, not the newer Messages-API (Mantle) endpoint, and must be called through the cross-region inference profile `us.anthropic.claude-haiku-4-5-20251001-v1:0` (verified listed and ACTIVE on 2026-10-10). Responses constrained with structured outputs (`output_config.format` with a JSON schema), then re-validated with Zod.

**AI-1: mood → deck.**
- Input: the moods (chips + free text, each ≤ 80 chars, voter names removed), ground rules, and a **candidate list** of ≤ 60 catalog entries (`id`, title, year, genres, tags, one-line logline) already filtered by the hard rules (services, runtime, film, adult).
- Output: `{ filters: {genresBoost[], genresAvoid[], tones[]}, shortlist: string[] /* 15 catalog ids */ }`.
- Server keeps only IDs present in the candidate list, de-duplicates, and tops up to 15 from the rule-based ranking if short.
- Runs **speculatively in the lobby**: whenever moods or rules change, a debounced (1.5 s) build starts, so the deck is usually ready before the host presses Start. On Start, the service waits at most for the remaining part of a **3.0 s** budget, then deals the rule-based deck.

**AI-2: tally → reason.**
- Input: **aggregates only** (winner title, genres, points, yes count, voter count, unanimous flag, whether it survived sudden death or a coin toss, and up to 3 room moods). Never voter names, never per-voter votes.
- Output: `{ reason: string }`, ≤ 140 characters, one sentence.
- Starts the moment the winner is known; **2.5 s** timeout so the verdict lands inside the 3 s NFR. Validated (length, single sentence, mentions no title other than the winner); on any failure the template is used.

**Fallbacks (AI-3, always on):**
- Deck: rule-based scorer (mood chip → genre weights table, popularity, recency), deterministic.
- Reason: templates keyed by outcome, e.g. "Everyone said yes, and {title} edged out {runnerUp} on super-yes votes."
- `AI_MODE=off|on` env switch so the demo never depends on Bedrock; the verdict payload records `reasonSource: "ai" | "template"` for logging and the AWS write-up.

**Prompting rules.** System prompt fixed and cached; user content wrapped and labelled as untrusted mood text so "ignore your instructions" moods cannot change the output schema or pick titles outside the candidate list.

## Alternatives considered

| Option | Why not (for now) |
| --- | --- |
| Claude Opus 5.5 | Highest quality, but its thinking cannot be disabled and its latency profile risks the 2.5–3 s budget for a one-sentence task. |
| Claude Sonnet 5.5 | Strong fallback choice; kept as the configured upgrade path. |
| Amazon Nova Micro/Lite | Fast and cheap; viable, but structured-output reliability for the shortlist would need its own testing. Can be swapped behind `AiPort`. |
| Bedrock Agents / Knowledge Bases | Far more machinery than two single calls need. |
| Embeddings + vector search for moods | Adds an index to build; a 60-item candidate list fits in one prompt. |

## Consequences

- Day-1 result (spike S3): the Anthropic use-case form is required per account. On the personal account, Bedrock is `NOT_AUTHORIZED` for every model until account activation completes. If Anthropic access is not granted by Oct 17, switch `BEDROCK_MODEL_ID` to Amazon Nova Lite (no third-party form) behind the same `AiPort`.
- Structured outputs on Haiku 4.5 via InvokeModel are unverified; the spike harness tests both `output_config.format` and a strict tool, and the adapter uses whichever passes.
- Cost is negligible: ~2 calls per round, < 3 K tokens each.
- AI improves the experience but never gates it; the core tier (Oct 17) ships with `AI_MODE=off`.
