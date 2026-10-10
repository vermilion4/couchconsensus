// Which phone screen to show for the current view (design: Join → Mood → Swipe → Waiting → Result).
import type {VoterView} from '@couch/protocol';

export type Screen = 'mood' | 'lobby' | 'swipe' | 'waiting' | 'thinking' | 'result' | 'closed';

export function screenFor(view: VoterView): Screen {
  switch (view.phase) {
    case 'lobby':
      return view.me.mood ? 'lobby' : 'mood';
    case 'voting':
    case 'suddenDeath':
      return view.me.ballot?.finished ? 'waiting' : 'swipe';
    case 'verdict':
      return 'result';
    case 'closed':
      return 'closed';
    case 'dealing':
    case 'tally':
      return 'thinking';
  }
}
