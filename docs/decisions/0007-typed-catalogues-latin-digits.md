# 0007 Typed message catalogues, Latin digits in Hindi

Date: 18 Oct 2026

**Catalogues.** `@rivr/i18n` uses plain TypeScript catalogues rather than an i18n library. English is the source; the Hindi catalogue is typed against it, so a missing Hindi key fails the typecheck instead of showing a key at runtime. Message keys are a union type, so `t('commn.retry')` is a compile error. Each area has its own namespace file, so parallel lanes add copy without editing the same file. A library (i18next) would add plural and ICU features we do not yet need; revisit at the third real need for plurals.

**Digits.** Money, points and times use Latin digits with Indian grouping (`₹1,20,000`, `02:40`) in both languages. The design prompt fixes this money format; Indian apps and bank statements use Latin digits in Hindi too, and one format keeps cage receipts, TV boards and staff screens consistent. Month and weekday names are translated.

Superseded where it concerns Hindi by 0027 (English only).
