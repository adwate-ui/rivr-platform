# Specification

Read in this order. When two documents disagree, the later one wins.

1. `scope-v1-2026-09-30.md`: functional modules, data model, acceptance tests. Its dates (January launch, phases P0 to P5) are superseded by the tech plan.
2. `tech-plan-v2-2026-10-11.md`: launch on 15 Nov, the 30 additions, release gates, lanes and first-version limits.
3. `design-prompt-2026-09-30.md`: brand, visual and copy rules, seed data, the twelve linked flows. Its seed has five tables; the build has six (see 5).
4. `features-2026-10-14.md`: roles, tournaments, check-in and check-out, call time, wallet, pot data, website editing, social, kill switch, exports, purge.
5. `additions-2026-10-14.md`: everything found missing in the 14 Oct audit, and the resolved conflicts. Its "Resolved conflicts" section overrides every earlier document; its "Tier-gated features" section applies to every member-facing feature; its "Design system" section applies to every surface.
6. `learn/`: the poker-settle drill specification, copied by Lane 0.

## Out of scope for this build

- Legal, regulatory and licensing work, and any step that says to confirm with counsel. Build the features those sections describe (TDS switch, AML register, consent, self-exclusion) as product features only. Ignore risk notes, "counsel to confirm" lines and policy rationale.
- Vendor contracts, account approvals and hardware procurement. Every vendor sits behind an adapter with a fake until its keys arrive.
- Book content. Licensed encodings are uploaded at runtime by a super admin; none enters the repository.
- Hindi, and any language other than English. RIVR ships in English only: one catalogue, no language setting (owner decision, 18 Oct 2026; decision 0027, #186). Spec lines that ask for Hindi are superseded.
