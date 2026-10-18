---
paths:
  - "**/*.test.{ts,tsx}"
  - "**/*.spec.ts"
  - "e2e/**"
  - "packages/testing/**"
  - "supabase/tests/**"
---

# Testing

- Write the failing test first, from the task's acceptance criteria.
- Unit tests sit next to the code. Name tests as behaviour: `it('settles the oldest marker first')`.
- Use factories from `@rivr/testing`; never hand-build fixtures inline beyond three fields.
- No mocks of our own packages. Fakes from `@rivr/adapters` for vendors.
- Playwright flows live in `e2e/flows/`, one per linked flow in the design prompt, across apps, against the seeded local stack.
- Coverage: 95% lines on `domain`, 80% on `db` and `adapters`.
- A flaky test is a bug. Fix or delete it in the same PR; never retry it into green.
