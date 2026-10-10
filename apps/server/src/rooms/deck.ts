// Rule-based deck builder (SV-5, AI-3 fallback): filter by ground rules, rank by the room's moods.
import {DEMO_REGION, MOOD_RULES, type CatalogFile, type Title} from '@couch/catalog';
import type {GroundRules, MoodChip, TitleId} from '@couch/protocol';

export interface DeckRequest {
  catalog: CatalogFile;
  rules: GroundRules;
  region: string;
  moods: {chips: MoodChip[]}[];
  /** Titles already dealt in this room (rematch, sudden death). */
  exclude: TitleId[];
  size: number;
}

/** Availability for the room's region; demo titles use the region-agnostic "ZZ". */
export function availabilityFor(title: Title, region: string) {
  return title.availability[region] ?? title.availability[DEMO_REGION] ?? [];
}

export function eligibleTitles(catalog: CatalogFile, rules: GroundRules, region: string): Title[] {
  return catalog.titles.filter(t => {
    if (t.adult && !rules.includeAdult) return false;
    if (t.kind !== rules.kind) return false;
    if (rules.maxRuntimeMin !== null && t.runtimeMin > rules.maxRuntimeMin) return false;
    const offers = availabilityFor(t, region);
    if (offers.length === 0) return false;
    return rules.services.length === 0 || offers.some(o => rules.services.includes(o.serviceId));
  });
}

function moodScore(title: Title, moods: {chips: MoodChip[]}[]): number {
  let score = 0;
  for (const {chips} of moods)
    for (const chip of chips) {
      const rule = MOOD_RULES[chip];
      const matches =
        rule.boost.some(g => title.genres.includes(g)) ||
        (rule.maxRuntimeMin !== undefined && title.runtimeMin <= rule.maxRuntimeMin);
      if (matches) score += 1;
      if (rule.avoid.some(g => title.genres.includes(g))) score -= 2;
    }
  return score;
}

export function buildDeck(req: DeckRequest): TitleId[] {
  const excluded = new Set(req.exclude);
  return eligibleTitles(req.catalog, req.rules, req.region)
    .filter(t => !excluded.has(t.id))
    .map(t => ({t, score: moodScore(t, req.moods)}))
    .sort((a, b) => b.score - a.score || b.t.popularity - a.t.popularity || a.t.id.localeCompare(b.t.id))
    .slice(0, req.size)
    .map(({t}) => t.id);
}
