# 0006 Function-length limit does not apply to test files

Date: 18 Oct 2026

`max-lines-per-function` is 40 (`docs/engineering/stack.md`). In a test file, each `describe()` and `it()` callback is a function, so a suite of six short tests already exceeds 40 lines inside its `describe`. The limit would cap test suites rather than functions.

Decision: `max-lines-per-function` is off for `*.test.ts(x)`, `*.spec.ts` and `e2e/**`. Every other rule applies to tests, including `max-lines` 250 per file, complexity 10 and the type-safety rules. A long test file is split by behaviour.

This scopes a rule rather than weakening it to get green; it was set before any test existed.
