// Verdict and the one-sentence reason (US-9). Template reasons are the AI-3 fallback; Bedrock can replace them later.
import type {CatalogFile} from '@couch/catalog';
import type {TallyResult, TitleScore} from '@couch/referee';
import type {Round, Verdict} from './model';

type Ranked = Extract<TallyResult, {kind: 'ranked'}>;

export function buildVerdict(round: Round, tally: Ranked, voters: number, catalog: CatalogFile, now: number): Verdict {
  const top = tally.ranking[0]!;
  const viaSuddenDeath = round.kind === 'suddenDeath';
  return {
    roundNo: round.parentNo ?? round.no,
    winner: top.titleId,
    rankingIds: tally.ranking.map(t => t.titleId),
    reason: templateReason(top, voters, titleName(catalog, top.titleId), {viaSuddenDeath, coinToss: !!tally.coinToss}),
    reasonSource: 'template',
    viaSuddenDeath,
    ...(tally.coinToss ? {coinToss: tally.coinToss} : {}),
    stats: {voters, yes: top.yes, superYes: top.superYes, unanimous: top.unanimous},
    decidedAt: now,
  };
}

export const titleName = (catalog: CatalogFile, id: string) => catalog.titles.find(t => t.id === id)?.title ?? 'This one';

/** One sentence, ≤ 140 characters, aggregates only (never who voted what). */
export function templateReason(
  top: TitleScore,
  voters: number,
  title: string,
  how: {viaSuddenDeath: boolean; coinToss: boolean},
): string {
  const s = (n: number) => (n === 1 ? '' : 's');
  let reason: string;
  if (how.coinToss) reason = `${title} won the coin toss after a dead heat.`;
  else if (how.viaSuddenDeath) reason = `${title} survived sudden death with ${top.yes} of ${voters} saying yes.`;
  else if (top.unanimous && top.superYes > 0)
    reason = `Everyone said yes to ${title}, and ${top.superYes} of you went super-yes.`;
  else if (top.unanimous) reason = `Everyone said yes to ${title}.`;
  else reason = `${title} scored highest with ${top.yes} yes vote${s(top.yes)} from ${voters} of you.`;
  return reason.length <= 140 ? reason : `${reason.slice(0, 137)}...`;
}
