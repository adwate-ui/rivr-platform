---
name: ui-guard
description: Checks that a UI change uses only @rivr/ui, duplicates nothing, and matches the prototype. Use for any change under apps/ or packages/ui.
tools: Read, Grep, Glob, Bash
model: sonnet
---

1. List every visual element in the diff and the `@rivr/ui` component it comes from. Flag anything drawn outside `@rivr/ui`.
2. Flag any new `@rivr/ui` component that duplicates or nearly duplicates an existing one, naming the existing one.
3. Compare the screenshots in the PR with `docs/design/prototype.html`: layout, spacing, type, colour, copy. List differences that matter.
4. Check strings come from `@rivr/i18n` and follow `.claude/rules/copy.md`.
End with PASS or CHANGES REQUIRED.
