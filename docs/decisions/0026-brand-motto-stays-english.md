# 0026 The brand motto stays English in Hindi

Date: 18 Oct 2026

The design prompt sets "Skill runs deep." once, on the sign-in screen, as part of the brand lockup. Every string has an English and a Hindi message, but no Hindi motto was given, and a translation made here would be a new brand line the owner has not seen.

Decision: `ui.brand.motto` carries the English line in both catalogues, like the name "RIVR". The Wordmark marks it `lang="en"`, so a screen reader reads it in English and it keeps the Bodoni italic on a Hindi page.

When the owner gives a Hindi motto, the Hindi catalogue takes it, and the Wordmark's `lang` must follow the locale and drop the italic for Devanagari, which has none.

Superseded where it concerns Hindi by 0027 (English only).
