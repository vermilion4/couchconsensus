// Builds the two Bedrock requests from a room (DATA_MODEL §8). Privacy rule (ADR-0010): no voter ids,
// no nicknames, no per-voter votes ever leave the server. Free text is scrubbed of the room's nicknames.
import type {CatalogFile} from '@couch/catalog';
import type {MoodChip} from '@couch/protocol';
import {buildDeck} from '../rooms/deck';
import type {Room} from '../rooms/model';
import type {DeckAsk, ReasonAsk} from './port';

/** At most this many rule-filtered titles go to the model; the prompt stays small and fast. */
export const MAX_CANDIDATES = 60;

/** undefined when nobody gave a mood: the rule-based deck is as good as it gets then. */
export function deckAsk(room: Room, catalog: CatalogFile): DeckAsk | undefined {
  const names = room.voters.map(v => v.nickname);
  const moods = room.moods
    .filter(m => !m.skipped && (m.chips.length > 0 || m.text))
    .map(m => ({chips: [...m.chips], ...(m.text ? {text: scrub(m.text, names)} : {})}))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))); // not join order
  if (moods.length === 0) return undefined;

  const dealt = room.rounds.flatMap(r => r.deck.map(c => c.titleId));
  const ids = buildDeck({catalog, rules: room.rules, region: room.region, moods, exclude: dealt, size: MAX_CANDIDATES});
  const candidates = ids.map(id => {
    const t = catalog.titles.find(x => x.id === id)!;
    return {id: t.id, title: t.title, year: t.year, genres: t.genres, tags: t.tags, logline: t.logline};
  });
  return {rules: {maxRuntimeMin: room.rules.maxRuntimeMin, region: room.region}, moods, candidates, deckSize: room.rules.deckSize};
}

/** The reason request plus the titles the answer may and may not name (for acceptReason). */
export function reasonAsk(
  room: Room,
  catalog: CatalogFile,
): {request: ReasonAsk; titles: {winner: string; runnerUp?: string; others: string[]}} | undefined {
  const v = room.verdict;
  if (!v) return undefined;
  const title = (id: string) => catalog.titles.find(t => t.id === id);
  const winner = title(v.winner);
  if (!winner) return undefined;
  const runnerUp = v.rankingIds[1] ? title(v.rankingIds[1]) : undefined;

  // Every title shown in the rounds that led to this verdict, so the reason can't name a loser by mistake.
  const shown = room.rounds.filter(r => r.no === v.roundNo || r.parentNo === v.roundNo).flatMap(r => r.deck.map(c => c.titleId));
  const others = [...new Set(shown)].filter(id => id !== v.winner).map(id => title(id)?.title).filter((t): t is string => !!t);

  const request: ReasonAsk = {
    winner: {title: winner.title, year: winner.year, genres: winner.genres, runtimeMin: winner.runtimeMin},
    ...(runnerUp ? {runnerUp: {title: runnerUp.title}} : {}),
    stats: v.stats,
    path: v.coinToss ? 'coinToss' : v.viaSuddenDeath ? 'suddenDeath' : 'normal',
    roomMoods: topChips(room),
  };
  return {request, titles: {winner: winner.title, ...(runnerUp ? {runnerUp: runnerUp.title} : {}), others}};
}

/** The room's three most common mood chips, most common first (ties: alphabetical). */
function topChips(room: Room): MoodChip[] {
  const counts = new Map<MoodChip, number>();
  for (const m of room.moods) if (!m.skipped) for (const c of m.chips) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([c]) => c);
}

function scrub(text: string, names: string[]): string {
  let out = text;
  for (const n of names) {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'), 'someone');
  }
  return out;
}
