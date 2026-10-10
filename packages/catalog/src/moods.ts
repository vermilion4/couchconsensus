// Rule-based mood → genre mapping: the deck builder's default and the fallback when AI is off (AI-3).
import type {MoodChip} from '@couch/protocol';
import type {Genre} from './schema';

export interface MoodRule {
  boost: Genre[];
  avoid: Genre[];
  /** For "short": titles at or under this runtime count as a match. */
  maxRuntimeMin?: number;
}

export const MOOD_RULES: Record<MoodChip, MoodRule> = {
  funny: {boost: ['comedy', 'animation'], avoid: ['horror', 'war']},
  cozy: {boost: ['family', 'animation', 'comedy', 'romance'], avoid: ['horror', 'war', 'thriller']},
  thrilling: {boost: ['thriller', 'action', 'crime', 'mystery'], avoid: []},
  scary: {boost: ['horror', 'thriller'], avoid: ['family']},
  romantic: {boost: ['romance'], avoid: ['horror', 'war']},
  mindBending: {boost: ['scienceFiction', 'mystery', 'thriller'], avoid: []},
  epic: {boost: ['adventure', 'fantasy', 'action', 'history', 'war'], avoid: []},
  feelGood: {boost: ['comedy', 'family', 'music', 'romance'], avoid: ['horror', 'war']},
  familyFriendly: {boost: ['family', 'animation'], avoid: ['horror']},
  short: {boost: [], avoid: [], maxRuntimeMin: 100},
};
