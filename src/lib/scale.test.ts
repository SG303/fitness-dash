import { describe, expect, it } from 'vitest';
import { linear, niceTicks } from './scale';

describe('niceTicks', () => {
  it('covers the range with round steps', () => {
    expect(niceTicks(0, 5222)).toEqual([0, 2000, 4000, 6000]);
    expect(niceTicks(18, 24.5)).toEqual([18, 20, 22, 24, 26]);
  });

  it('handles a flat range', () => {
    const ticks = niceTicks(20, 20);
    expect(ticks[0]).toBeLessThan(20);
    expect(ticks.at(-1)).toBeGreaterThan(20);
  });
});

describe('linear', () => {
  it('maps the domain onto the range', () => {
    const y = linear(0, 100, 200, 0);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
  });
});
