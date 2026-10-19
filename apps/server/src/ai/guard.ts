// The AI-3 safety net: every Bedrock call runs inside a time budget, and every answer is checked
// before it can touch a room. Anything late, failed or off-spec falls back to the rule-based path.

export type Budgeted<T> = {ok: true; value: T} | {ok: false; error: string};

/** Runs fn with an abort signal; resolves (never rejects) by the deadline. */
export async function withBudget<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<Budgeted<T>> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<Budgeted<T>>(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ok: false, error: 'timeout'});
    }, ms);
  });
  const call = fn(controller.signal).then(
    (value): Budgeted<T> => ({ok: true, value}),
    (e: unknown): Budgeted<T> => ({ok: false, error: e instanceof Error ? e.message : String(e)}),
  );
  try {
    return await Promise.race([call, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/** Keeps candidate ids only, each once, in the model's order, capped at the deck size. */
export function acceptShortlist(ids: readonly string[], candidates: readonly string[], size: number): string[] {
  const allowed = new Set(candidates);
  const out: string[] = [];
  for (const id of ids) if (allowed.has(id) && !out.includes(id)) out.push(id);
  return out.slice(0, size);
}

export const MAX_REASON_CHARS = 140;

/**
 * One sentence, at most 140 characters, and no title named except the winner (and the runner-up when
 * the request included one). Returns the trimmed reason, or undefined to use the template.
 */
export function acceptReason(raw: string, titles: {winner: string; runnerUp?: string; others: readonly string[]}): string | undefined {
  const reason = raw.trim();
  if (!reason || reason.length > MAX_REASON_CHARS || /[\r\n]/.test(reason)) return undefined;
  // A sentence end followed by more text means a second sentence.
  if (/[.!?]["”’)]?\s+\S/.test(reason)) return undefined;
  const allowed = new Set([titles.winner, titles.runnerUp].filter(Boolean).map(t => t!.toLowerCase()));
  if (titles.others.some(t => !allowed.has(t.toLowerCase()) && mentions(reason, t))) return undefined;
  return reason;
}

/** Whole-title match, case-insensitive: "Test Film 1" is not found inside "Test Film 10". */
function mentions(text: string, title: string): boolean {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}
