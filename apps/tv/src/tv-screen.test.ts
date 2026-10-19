import {describe, expect, it} from 'vitest';
import type {TvView} from '@couch/protocol';
import {lobbyHint, progressLabel, regionName, rulesChips, runtimeLabel, tossLede, tossMeta, tvScreenFor, verdictTitleSize} from './tv-screen';

const base: TvView = {
  audience: 'tv',
  rev: 1,
  serverNow: 1,
  roomCode: 'KDRM',
  joinUrl: 'http://x/r/KDRM',
  phase: 'lobby',
  rules: {
    services: [],
    maxRuntimeMin: null,
    kind: 'film',
    includeAdult: false,
    deckSize: 15,
    roundSeconds: 90,
    region: 'ZZ',
    availableServices: [
      {id: 'demo:streamco', name: 'StreamCo'},
      {id: 'demo:flixbox', name: 'FlixBox'},
      {id: 'demo:reelhub', name: 'ReelHub'},
    ],
  },
  voters: [],
  canStart: false,
};
const voter = (over: Partial<TvView['voters'][number]> = {}): TvView['voters'][number] => ({
  id: 'v_aaaaaaaa',
  nickname: 'Ada',
  connected: true,
  moodDone: true,
  progress: {done: 0, total: 15},
  finished: false,
  ...over,
});

describe('tvScreenFor', () => {
  it('maps each phase to its TV screen', () => {
    expect(tvScreenFor({...base, phase: 'lobby'})).toBe('lobby');
    expect(tvScreenFor({...base, phase: 'dealing'})).toBe('thinking');
    expect(tvScreenFor({...base, phase: 'voting'})).toBe('scoreboard');
    expect(tvScreenFor({...base, phase: 'tally'})).toBe('thinking');
    expect(tvScreenFor({...base, phase: 'suddenDeath'})).toBe('scoreboard');
    expect(tvScreenFor({...base, phase: 'verdict'})).toBe('verdict');
    expect(tvScreenFor({...base, phase: 'closed'})).toBe('closed');
  });
});

describe('rulesChips', () => {
  it('reads the defaults as all services, any length, films', () => {
    expect(rulesChips(base.rules)).toEqual(['All services', 'Any length', 'Films']);
  });

  it('names up to two chosen services, then counts them', () => {
    expect(rulesChips({...base.rules, services: ['demo:flixbox'], maxRuntimeMin: 120})).toEqual(['FlixBox', 'Up to 2 hours', 'Films']);
    expect(rulesChips({...base.rules, services: ['demo:flixbox', 'demo:streamco']})[0]).toBe('FlixBox, StreamCo');
    expect(rulesChips({...base.rules, services: ['demo:flixbox', 'demo:streamco', 'demo:reelhub']})[0]).toBe('3 services');
  });
});

describe('labels', () => {
  it('spells out each runtime cap', () => {
    expect([90, 105, 120, 150, null].map(m => runtimeLabel(m as never))).toEqual(['90 min', '105 min', '2 hours', '2½ hours', 'No limit']);
  });

  it('shows progress as counts, Done when finished, and flags a dropped phone', () => {
    expect(progressLabel(voter({progress: {done: 6, total: 15}}))).toBe('6 of 15');
    expect(progressLabel(voter({finished: true, progress: {done: 15, total: 15}}))).toBe('Done');
    expect(progressLabel(voter({connected: false, progress: {done: 2, total: 5}}))).toBe('Offline, 2 of 5');
  });

  it('tells the host when the room can start', () => {
    expect(lobbyHint({...base, voters: []})).toBe('Waiting for at least 2 people to join.');
    expect(lobbyHint({...base, voters: [voter()]})).toBe('1 person is in. Waiting for at least one more.');
    expect(lobbyHint({...base, voters: [voter(), voter({moodDone: false})], canStart: true})).toBe(
      "2 people are in. 1 is still picking a mood. Start when everyone's here.",
    );
    expect(lobbyHint({...base, voters: [voter(), voter()], canStart: true})).toBe("2 people are in. Start when everyone's here.");
  });

  it('names the region, with the demo catalog called out', () => {
    expect(regionName('US')).toBe('United States');
    expect(regionName('ZZ')).toBe('Demo catalog');
    expect(regionName('NZ')).toBe('NZ');
  });
});

describe('tossLede', () => {
  it('counts the tied titles, so a five-way sudden-death tie reads right', () => {
    expect(tossLede(2)).toBe('Two titles tied on every rule. The referee flips a coin.');
    expect(tossLede(5)).toBe('5 titles tied on every rule. The referee flips a coin.');
  });
});

describe('verdictTitleSize', () => {
  it('uses Figma\'s 160 px for short titles and steps down so long ones stay within two lines', () => {
    expect(verdictTitleSize('Pancake Heist')).toBe(160);
    expect(verdictTitleSize('Snow Globe Holiday')).toBe(120);
    expect(verdictTitleSize('Wolves of the Frozen Pass')).toBe(96);
  });
});

describe('tossMeta', () => {
  it('describes the tied votes, which every finalist shares', () => {
    expect(tossMeta({voters: 5, yes: 4, superYes: 1, unanimous: false})).toBe('4 yes, 1 super-yes');
    expect(tossMeta({voters: 5, yes: 2, superYes: 0, unanimous: false})).toBe('2 yes');
    expect(tossMeta({voters: 4, yes: 0, superYes: 0, unanimous: false})).toBe('No yes votes');
  });
});
