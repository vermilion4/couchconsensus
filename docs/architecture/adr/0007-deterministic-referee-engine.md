# ADR-0007: Deterministic, pure referee engine; AI never decides

- Status: Accepted
- Date: 2026-10-10

## Context

Principle 5 ("always one answer") and principle 6 ("the referee explains itself") require a winner that is guaranteed, explainable and testable. AI-1 and AI-2 bring an LLM into the flow, which must not make outcomes non-deterministic or blockable.

## Decision

`@couch/referee` is a pure function library with no I/O:

```ts
rankTitles(input: TallyInput): TallyResult
// TallyResult = { kind: "ranked", ranking: RankedTitle[], coinToss?: CoinToss }
//             | { kind: "suddenDeath", reason: "noYes" | "allVetoed" }
```

Rules, exactly as in the requirements:

1. Unreached cards count as **No**. Voters in the round = every voter seated before the round ended (late joiners included).
2. Remove every title with ≥ 1 veto.
3. If no surviving title has ≥ 1 Yes/Super-yes → `suddenDeath`.
4. Group A: titles where **every** voter in the round voted Yes or Super-yes (unanimous). Group B: the rest. A ranks above B.
5. Within a group: points desc (Yes = 1, Super-yes = 2) → fewer No → more Super-yes → household memory (SV-7, see [ADR-0013](0013-household-tiebreak-memory.md)) → coin toss.
6. Coin toss is a seeded PRNG (`mulberry32(fnv1a(roomId, roundNo, kind, sorted tied titleIds))`), so a replay gives the same result. The result is recorded in the verdict for the TV animation. Lower tied runs are ordered the same way, so Runner-up is deterministic too.

Note (found while implementing): "more super-yes" can never break a tie on its own. Every voter either votes on a card or the card counts as No for them, and vetoed cards are removed, so equal points and equal Nos force equal super-yes counts. The rule stays in the order for fidelity to the requirements, but the effective tie-breakers are fewer No → household memory → coin toss.

Sudden death: 5 new cards, Yes/No only (no veto, no super-yes), top points wins; ties go straight to the coin toss. It always returns a winner, even if every vote is No (all tie at 0 → coin toss).

The engine returns the full ranking, so **Runner-up** (TV-6) is just `ranking[verdict.index + 1]`, skipping nothing because vetoed titles are already removed. If the ranking is exhausted, Runner-up is disabled.

## Alternatives considered

- **Let the LLM pick or re-rank.** Non-deterministic, untestable, and slow. Rejected.
- **Borda count / approval voting variants.** The requirements already define the rules; the engine implements them as written.

## Consequences

- The worked example in the requirements becomes the first unit test.
- Property tests (fast-check): a vetoed title never wins; the result always has exactly one winner; the result is invariant to voter order; adding a Super-yes never lowers a title's rank.
- Implemented 2026-10-10 in `packages/referee/src/rank.ts`: 11 example tests + 5 property tests; mutation-checked (ignoring vetoes or inverting points makes the properties fail).
