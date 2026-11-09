import { describe, expect, it } from 'vitest';
import { FEEDBACK_AGE_TARGET_SECONDS, isFeedbackOverdue } from './feedback.ts';

describe('an open ticket\u2019s age', () => {
  it('is past its target only after two days', () => {
    expect(FEEDBACK_AGE_TARGET_SECONDS).toBe(172_800);
    expect(isFeedbackOverdue(172_800)).toBe(false);
    expect(isFeedbackOverdue(172_801)).toBe(true);
    expect(isFeedbackOverdue(0)).toBe(false);
  });
});
