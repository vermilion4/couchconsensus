import {describe, it} from 'vitest';

// Cases from the requirements ("How the referee decides") and ADR-0007.
// Written first; turned into real tests when rankTitles is implemented.
describe('rankTitles', () => {
  it.todo('worked example: Film B (unanimous, 3 pts) beats Film A (3 pts, not unanimous); Film C removed by veto');
  it.todo('unreached cards count as No');
  it.todo('a vetoed title never wins');
  it.todo('asks for sudden death when no surviving title has a yes');
  it.todo('asks for sudden death when every title is vetoed');
  it.todo('ties break by fewer No, then more super-yes, then household memory, then a seeded coin toss');
  it.todo('the coin toss is reproducible for the same room, round and titles');
  it.todo('sudden death always returns a winner, even when every vote is No');
  it.todo('result does not depend on voter order');
});
