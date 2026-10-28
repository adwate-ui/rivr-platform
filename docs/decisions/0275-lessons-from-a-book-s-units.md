# 0275: Lessons from a book's units

Date: 28 Oct 2026. Issue #134; the owner said on 28 Oct: "Don't write the encoding yourself".

- **A lesson is a unit.** Each unit of a book (`source_units`) with principles in force is a lesson:
  - **Cards:** the unit's principles, one at a time, each with its name and the author's reasoning.
  - **Quiz:** up to five questions.
    - **The book's own hands first.** The book's own label and count quiz hands come first (the owner on #579). A quiz hand carries no unit, so each is placed in the lesson whose principle decides it, and only where that principle answers as the author did.
    - **Then dealt spots.** The rest are dealt by the drill engine from the unit's label (classify) and count principles. The engine grades them with the book's own feedback, as the drills do (`generateScenario`, `resolveGoverningAny` with the answer kind, `gradeAnswer`, `explain`).
  - **No quiz:** a unit with no label or count principle has cards only.
- **No content of RIVR's own yet.** The Academy's Levels 1 to 3 are RIVR's to encode; this build does not author one. Lessons work for any book: today the two Ed Miller books (decision 0274). "How To Read Hands" has quizzes in four units; "The Course" has cards only. The Learn screen's "RIVR Academy levels" block keeps its empty state until RIVR's encoding arrives.
- **Kept per lesson.** `learn_lesson` keeps each finished lesson's latest result for the member (right answers of those asked), with `public.complete_learn_lesson`. Erasure deletes it.
- **Gated by tier.** Lessons are gated by `learn.academy_lessons` in the database and the app (rule 8), inside the book screen's `learn.drills`.
