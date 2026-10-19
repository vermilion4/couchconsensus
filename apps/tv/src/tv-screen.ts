// Which TV screen to show for the current view, plus the words the TV puts on screen.
// Pure, so it runs under Vitest without React Native.
import type {GroundRules, TvView} from '@couch/protocol';

export type TvScreen = 'lobby' | 'scoreboard' | 'thinking' | 'verdict' | 'closed';
type TvVoter = TvView['voters'][number];

export function tvScreenFor(view: TvView): TvScreen {
  switch (view.phase) {
    case 'lobby':
      return 'lobby';
    case 'voting':
    case 'suddenDeath':
      return 'scoreboard';
    case 'dealing':
    case 'tally':
      return 'thinking';
    case 'verdict':
      return 'verdict';
    case 'closed':
      return 'closed';
  }
}

const RUNTIME: Record<string, string> = {90: '90 min', 105: '105 min', 120: '2 hours', 150: '2½ hours'};

export const runtimeLabel = (m: GroundRules['maxRuntimeMin']): string => (m === null ? 'No limit' : RUNTIME[m]!);

/** The three chips under "Ground rules" in the lobby (TV-7). */
export function rulesChips(rules: TvView['rules']): string[] {
  const names = rules.services.map(id => rules.availableServices.find(s => s.id === id)?.name ?? id);
  const services = names.length === 0 ? 'All services' : names.length <= 2 ? names.join(', ') : `${names.length} services`;
  const length = rules.maxRuntimeMin === null ? 'Any length' : `Up to ${runtimeLabel(rules.maxRuntimeMin)}`;
  return [services, length, 'Films'];
}

/** Counts only: the TV never learns how anyone voted (TV-4, I8). */
export function progressLabel(v: TvVoter): string {
  if (v.finished) return 'Done';
  const counts = `${v.progress.done} of ${v.progress.total}`;
  return v.connected ? counts : `Offline, ${counts}`;
}

export function lobbyHint(view: TvView): string {
  const n = view.voters.length;
  if (n === 0) return 'Waiting for at least 2 people to join.';
  if (!view.canStart) return `${n} ${n === 1 ? 'person is' : 'people are'} in. Waiting for at least one more.`;
  const picking = view.voters.filter(v => !v.moodDone).length;
  const moods = picking ? ` ${picking} ${picking === 1 ? 'is' : 'are'} still picking a mood.` : '';
  return `${n} people are in.${moods} Start when everyone's here.`;
}

const REGIONS: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  IE: 'Ireland',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  IN: 'India',
  JP: 'Japan',
  BR: 'Brazil',
  MX: 'Mexico',
  ZZ: 'Demo catalog',
};

/** Hermes on Vega has no Intl.DisplayNames, so the regions we expect are named here. */
export const regionName = (code: string): string => REGIONS[code] ?? code;

export const tossLede = (n: number): string =>
  `${n === 2 ? 'Two' : n} titles tied on every rule. The referee flips a coin.`;

/** Display size for the verdict title: Figma's 160 px fits about 14 characters in two lines. */
export const verdictTitleSize = (title: string): number => (title.length <= 14 ? 160 : title.length <= 20 ? 120 : 96);

/** Tied titles share every count, so the verdict's stats describe each finalist. */
export function tossMeta(stats: {yes: number; superYes: number; voters?: number; unanimous?: boolean}): string {
  if (stats.yes === 0) return 'No yes votes';
  return stats.superYes ? `${stats.yes} yes, ${stats.superYes} super-yes` : `${stats.yes} yes`;
}
