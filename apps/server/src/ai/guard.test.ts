import {describe, expect, it} from 'vitest';
import {acceptReason, acceptShortlist, withBudget} from './guard';

describe('withBudget', () => {
  it('returns the result when the call finishes in time', async () => {
    await expect(withBudget(async () => 'ok', 200)).resolves.toEqual({ok: true, value: 'ok'});
  });

  it('gives up at the deadline and aborts the call', async () => {
    let aborted = false;
    const slow = (signal: AbortSignal) =>
      new Promise<string>(resolve => {
        signal.addEventListener('abort', () => (aborted = true));
        setTimeout(() => resolve('late'), 500);
      });
    await expect(withBudget(slow, 20)).resolves.toEqual({ok: false, error: 'timeout'});
    expect(aborted).toBe(true);
  });

  it('reports a failed call instead of throwing', async () => {
    await expect(withBudget(async () => Promise.reject(new Error('Operation not allowed')), 200)).resolves.toEqual({
      ok: false,
      error: 'Operation not allowed',
    });
  });
});

describe('acceptShortlist', () => {
  const candidates = ['demo:0001', 'demo:0002', 'demo:0003', 'demo:0004'];

  it('keeps only candidate ids, once each, in the model order, up to the deck size', () => {
    expect(acceptShortlist(['demo:0003', 'demo:9999', 'demo:0003', 'demo:0001', 'demo:0002'], candidates, 2)).toEqual([
      'demo:0003',
      'demo:0001',
    ]);
  });

  it('returns nothing usable for an empty or invented list', () => {
    expect(acceptShortlist(['demo:9999'], candidates, 15)).toEqual([]);
  });
});

describe('acceptReason', () => {
  const titles = {winner: 'Paper Lanterns', others: ['Pancake Heist', 'Snow Globe Holiday']};

  it('accepts one short sentence and trims it', () => {
    expect(acceptReason('  Everyone wanted something cozy, and Paper Lanterns glowed brightest.  ', titles)).toBe(
      'Everyone wanted something cozy, and Paper Lanterns glowed brightest.',
    );
  });

  it('rejects more than 140 characters', () => {
    expect(acceptReason(`Paper Lanterns won ${'very '.repeat(30)}clearly.`, titles)).toBeUndefined();
  });

  it('rejects more than one sentence or a line break', () => {
    expect(acceptReason('Paper Lanterns won. It was close.', titles)).toBeUndefined();
    expect(acceptReason('Paper Lanterns won\nclearly.', titles)).toBeUndefined();
  });

  it('rejects a reason that names another title from the deck', () => {
    expect(acceptReason('Paper Lanterns beat Pancake Heist on super-yes votes.', titles)).toBeUndefined();
  });

  it('allows the runner-up by name when the room got one', () => {
    expect(acceptReason('Paper Lanterns edged out Pancake Heist on super-yes votes.', {...titles, runnerUp: 'Pancake Heist'})).toBe(
      'Paper Lanterns edged out Pancake Heist on super-yes votes.',
    );
  });

  it('matches whole titles, so "Test Film 1" does not trip on "Test Film 10"', () => {
    expect(acceptReason('Test Film 10 won it.', {winner: 'Test Film 10', others: ['Test Film 1']})).toBe('Test Film 10 won it.');
  });

  it('rejects an empty reason', () => {
    expect(acceptReason('   ', titles)).toBeUndefined();
  });
});
