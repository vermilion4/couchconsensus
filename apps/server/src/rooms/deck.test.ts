import {describe, expect, it} from 'vitest';
import {DEFAULT_RULES} from '@couch/protocol';
import {buildDeck} from './deck';
import {TEST_CATALOG} from './test-catalog';

const base = {catalog: TEST_CATALOG, rules: DEFAULT_RULES, region: 'US', moods: [], exclude: [], size: 15};

describe('buildDeck', () => {
  it('never deals adult titles', () => {
    expect(buildDeck(base)).not.toContain('demo:0011');
  });

  it('respects the maximum runtime', () => {
    const deck = buildDeck({...base, rules: {...DEFAULT_RULES, maxRuntimeMin: 105}});
    const runtimes = deck.map(id => TEST_CATALOG.titles.find(t => t.id === id)!.runtimeMin);
    expect(Math.max(...runtimes)).toBeLessThanOrEqual(105);
    expect(deck).toHaveLength(6); // 1, 2, 4, 6, 8, 10
  });

  it('only deals titles on the services the room has', () => {
    const deck = buildDeck({...base, rules: {...DEFAULT_RULES, services: ['demo:flixbox']}});
    expect(deck.sort()).toEqual(['demo:0002', 'demo:0004', 'demo:0007', 'demo:0009']);
  });

  it('puts titles matching the room\'s moods first', () => {
    const deck = buildDeck({...base, moods: [{chips: ['familyFriendly']}, {chips: ['funny']}]});
    // family + comedy match two moods; it should lead the deck
    expect(deck[0]).toBe('demo:0004');
    expect(deck.slice(0, 3)).toEqual(expect.arrayContaining(['demo:0001', 'demo:0008']));
  });

  it('pushes titles a mood avoids to the back', () => {
    const deck = buildDeck({...base, moods: [{chips: ['cozy']}]});
    // cozy avoids horror (2) and thriller (5)
    expect(deck.slice(-2).sort()).toEqual(['demo:0002', 'demo:0005']);
  });

  it('caps the deck size and skips excluded titles', () => {
    const deck = buildDeck({...base, size: 3, exclude: ['demo:0001']});
    expect(deck).toHaveLength(3);
    expect(deck).not.toContain('demo:0001');
  });

  it('is deterministic', () => {
    expect(buildDeck(base)).toEqual(buildDeck(base));
  });
});
