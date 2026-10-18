# 0015 The drill engine carries no book content

Date: 18 Oct 2026

The engine was ported from poker-settle, which committed two licensed encodings beside it and let the book leak into the code: quotes and page numbers in comments, book principle and range ids, worked hands, a book's printed range counts in tests, and allowlists citing pages. This repository is public, and `docs/spec/README.md` puts book content out of scope.

Decision: `packages/drills` and `docs/spec/learn` hold no text, example, number, id or page reference taken from a book. The licensed encodings, their catalogue and the tests that loaded them were not copied. Every comment that quoted or cited a book was rewritten in our own words; every test built from a book's printed hands, boards, ranges or counts was rebuilt on invented data proving the same property (combo counts re-derived by hand); the gate allowlists are empty. The two Learn docs keep their teaching with invented examples and name the licensed title once, as a product fact.

Encodings arrive at runtime: a super admin uploads one from the console, the engine's validator checks it, and it is stored privately. The only encodings in the repository are the invented fixtures in `packages/drills/fixtures/`.

Consequence: a reviewer can reject any change that adds a quote, page reference or book id to these paths. Running the gates against a licensed file uses `--dir` with a folder outside the repository.
