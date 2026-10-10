// Design tokens (Figma: Foundations page). Fire TV orange is the one brand color.
// Contrast on Night: fireOrange 5.3:1, ember 7.7:1, glow 16.1:1, mist 7.5:1.
// Text on fireOrange is always Night (5.3:1); white on orange is only 3.4:1.

export const color = {
  /** Focus ring, primary action, the winner. */
  fireOrange: '#FC4C02',
  /** Small orange text on Night. */
  ember: '#FF8A4C',
  /** Background: a dark living room lit by the TV. */
  night: '#0E1626',
  /** Panels, unfocused buttons. */
  couch: '#1A2740',
  /** Tracks, chips, raised surfaces. */
  cushion: '#25365A',
  /** Primary text. */
  glow: '#F7F1E8',
  /** Secondary text. */
  mist: '#9AA8BF',
  error: '#FF8A80',
} as const;

/** One per voter, in join order; each person keeps theirs for the whole session. */
export const voterColors = [
  '#2EC4B6', // teal
  '#9B8CFF', // violet
  '#C6E94B', // lime
  '#4FB3FF', // sky
  '#FF6FA8', // pink
  '#FFC23D', // gold
  '#5EE6A0', // mint
  '#E8E1D7', // chalk
] as const;

export const font = {
  display: 'Bricolage Grotesque',
  body: 'Figtree',
} as const;

export const voterColor = (joinIndex: number): string => voterColors[joinIndex % voterColors.length]!;
