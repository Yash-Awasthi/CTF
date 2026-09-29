import { describe, expect, it } from 'vitest';
import { CASEBOOK } from '../../challenges/shared/casebook';

describe('casebook', () => {
  it('has one log entry for every slot', () => {
    expect(Object.keys(CASEBOOK).map(Number).sort((a, b) => a - b)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    for (const text of Object.values(CASEBOOK)) expect(text.length).toBeGreaterThan(20);
  });
});
