# 0608 "Bonus chips" become "Bonus"

Date: 15 Nov 2026. Issue 955 (redesign RD-12; `docs/spec/redesign-2026-11-15.md` slice 2, corrections 22 and 25).

- "Bonus" takes a capital as the balance's name and as the unit after a number ("1,000 Bonus"). It is singular: "Bonus is added", "Bonus goes in whole 50s". A promotion's name is sentence case: "Four-hour bonus", "Tuesday seat bonus".
- The builder's reward choices drop the word, as correction 22 asks. Its three Bonus rewards are named for when they pay: "First seat", "Hours played", "Visit or referral". The prototype's "Buy-in", "Referral" and "High hand" are choices the builder does not have as kinds of their own today; high hand comes with RD-23.
- The builder's amount field is labelled "Amount", with "Bonus" as the unit after it, so the word is not said twice.
- The console's sign-in says "Resend code" and "Resend code in 0:24", as the player app does. The second code still goes by SMS, and the field still says so once it has.
- A catalogue test (`packages/i18n/src/copy.test.ts`) refuses "bonus chips" in every string. The rows the database holds are rewritten whatever the case they were typed in ("Bonus Chips").
- In the database (migration `20261118100000`): feature names, two settings' descriptions, the promotions the templates made and the templates themselves, and every published block of a venue's website. A promotion's name an admin typed is left as typed. Saved versions of a website page are left as saved.
- Left as they are: the messages of exceptions (no screen shows one; each is read by its code), the ledger's note on a redemption, comments, test fixtures' "about" text, and every identifier (`bonus_chips`, `bonusChips`, `give_bonus_chips`).
- No WhatsApp template's registered text says "bonus chips", so none is registered again.
- Rupees and "chips" elsewhere: the player's rows and join sheet keep the minimum buy-in's rupee figure, and Tables setup its field, which the owner's rule allows. The settings' money fields sit in areas hidden since 29 Oct (decision 0284) and are not changed here.
