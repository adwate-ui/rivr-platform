import { getConfig } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('Testing Library in a jsdom package', () => {
  it('waits up to 5 seconds, from the shared Vitest setup, in the copy the tests import', () => {
    expect(getConfig().asyncUtilTimeout).toBe(5_000);
  });
});
