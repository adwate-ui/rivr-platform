# 0439: The spin wheel's budget in bonus chips

Date: 3 Nov 2026. The owner, during console v3's integration: show `spin.budget` in Settings as bonus chips a month, with no ₹ anywhere, so the Spin wheel's budget link lands on it.

- **Why it was hidden.** Decision 0284 took every rupee off the console, and `spin.budget` is stored in paise, so Settings hid it. The Spin wheel then said a bonus prize was off the wheel because of a budget nobody could see (#811).
- **Unit.** One bonus chip is 100 paise, the unit the promotions model uses for its `chips` (decision 0438). A budget of ₹5,000 reads "5,000 bonus chips" and is typed as 5,000; the schema's whole ₹50 chips become "In fifties."
- **Storage.** Unchanged: `monthly_paise`, converted only for display and entry in the console (`apps/console/src/features/settings/components/bonusChips.ts`). No data migration.
- **Who.** As before: staff who open Settings' rules (`settings.manage` or `venue.configure`) see it and get the Spin wheel's link to it.
