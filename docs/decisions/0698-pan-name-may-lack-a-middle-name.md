# 0698: A PAN's name may lack, or add, a middle name

Date: 19 Nov 2026. Issue #1021. Changes the strictness in decision 0671.

The owner chose "Middle name may be missing": the names match when the first and last names agree and only middle names differ. An initial still fails.

How `namesMatch` (`@rivr/domain/identity`) reads that:
- **The rule.** The shorter name has two words or more, and every one of its words is in the longer name. The member's first and last names, as they gave them, are the document's first and last. The document is read as written or with its surname first, since a PAN may give it first.
- **Order.** Names of the same length still match in any order, as before. Case, spacing and punctuation are still set aside.
- **Matches:** `RAHUL KUMAR SHARMA` is `Rahul Sharma`, either way round.
- **Fails:** `R SHARMA` (an initial), `RAHUL SHARMA` against `Rahul Sharma Zutshi` (a last name on one only), and `SHARMA` alone.
- **Order with a middle name.** A surname-first PAN with its middle name last (`SHARMA RAHUL KUMAR`) matches `Rahul Sharma`, but never `Kumar Sharma`: the first name may not be the word that is dropped (security review).
- **What a failure does,** unchanged: the app refuses the PAN. At a desk check's recheck, the check goes back to staff.
