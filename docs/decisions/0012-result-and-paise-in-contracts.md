# 0012 Result and Paise live in @rivr/contracts

Date: 18 Oct 2026

Domain, adapters, db and the Edge Functions all return expected failures and all carry money. If each defined its own `Result` or its own branded paise, values would need converting at every boundary, and two `Paise` brands would not be assignable to each other.

Decision: `@rivr/contracts` defines `Result<T, E>` with `ok()` and `err()`, and `paiseSchema`, a Zod schema that brands a bigint (or the integer string Postgres returns) as `Paise`. `@rivr/domain/money` re-exports `Paise` and is the only place that builds or combines amounts; it brands its results through the same schema, so no type assertion is needed anywhere. JavaScript numbers are rejected as paise, because above 2^53 they lose paise silently.

Consequence: an amount parsed at an API edge is already the type the domain takes. Contracts imports no other `@rivr` package, so every package can depend on it.
