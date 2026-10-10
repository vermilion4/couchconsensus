import {describe, expect, it} from 'vitest';
import type {VoterView} from '@couch/protocol';
import {screenFor} from './screen';

const base: VoterView = {
  audience: 'voter',
  rev: 1,
  serverNow: 0,
  roomCode: 'KDRM',
  phase: 'lobby',
  me: {id: 'v_aaaaaaaa', nickname: 'Ada'},
  roomSize: 2,
};
const timer = {endsAt: 90_000, serverNow: 0, durationMs: 90_000};
const round = {no: 1, kind: 'main' as const, timer, deck: [], allowVeto: true, allowSuperYes: true};

describe('screenFor', () => {
  it('asks for a mood first, then waits in the lobby', () => {
    expect(screenFor(base)).toBe('mood');
    expect(screenFor({...base, me: {...base.me, mood: {chips: [], skipped: true}}})).toBe('lobby');
  });

  it('shows the swipe deck while voting, and waiting once my deck is done', () => {
    const ballot = {votes: [], vetoAvailable: true, superYesAvailable: true, finished: false};
    const voting = {...base, phase: 'voting' as const, round, me: {...base.me, ballot}};
    expect(screenFor(voting)).toBe('swipe');
    expect(screenFor({...voting, me: {...voting.me, ballot: {...ballot, finished: true}}})).toBe('waiting');
  });

  it('a late joiner skips the mood question and goes straight to the deck', () => {
    const ballot = {votes: [], vetoAvailable: true, superYesAvailable: true, finished: false};
    expect(screenFor({...base, phase: 'voting', round, me: {...base.me, ballot}})).toBe('swipe');
  });

  it('sudden death uses the swipe screen too', () => {
    const ballot = {votes: [], vetoAvailable: false, superYesAvailable: false, finished: false};
    expect(screenFor({...base, phase: 'suddenDeath', round: {...round, kind: 'suddenDeath'}, me: {...base.me, ballot}})).toBe('swipe');
  });

  it('shows the result after the verdict and a closed notice at the end', () => {
    expect(screenFor({...base, phase: 'verdict'})).toBe('result');
    expect(screenFor({...base, phase: 'closed'})).toBe('closed');
  });

  it('shows a holding screen during the brief referee moments', () => {
    expect(screenFor({...base, phase: 'tally'})).toBe('thinking');
    expect(screenFor({...base, phase: 'dealing'})).toBe('thinking');
  });
});
