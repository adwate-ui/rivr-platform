# 0027 English only

Date: 18 Oct 2026. Issue: #186.

The spec asked for every screen in English and Hindi, and Lane 0 built that in: a Hindi catalogue typed against the English one, Hindi stories and screenshots, Devanagari font fallbacks, and a language passed through sign-in to pick the WhatsApp template.

The owner decided RIVR ships in English only.

Decision: one catalogue (`en`) and no locale anywhere. `t(key, params)` from `@rivr/i18n` is the one way to get copy. The formatters take no language, and no member or dealer has a language setting. Sign-in sends the English `sign_in_code` template. Spec lines, task text and decisions that ask for Hindi are superseded: 0007 (Latin digits in Hindi) and 0026 (the motto on a Hindi page).

The Devanagari fonts stay in the tokens: Bodoni Moda and Instrument Sans have no ₹ sign, and Tiro Devanagari Hindi and Noto Sans Devanagari draw it. Without them the TV jackpot slide's baseline changes by 15,740 pixels; the ₹ is the only non-Latin character on it.

`member.preferred_language` (`'en'` or `'hi'`) is dropped by a new migration, since the applied one may not be edited (rule 9). The house-rules sample copy in a Container story stays: it describes table talk, not the app.

Adding a language later means a second catalogue typed against `en`, a locale in context, the `hindi:` variant for letter-spacing, and a `lang` that follows the locale: the shape 0007 described. The fonts are already there.
