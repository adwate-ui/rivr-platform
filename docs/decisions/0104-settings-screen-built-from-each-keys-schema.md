# 0104: The Settings screen builds each form from the key's schema in the database

Date: 2026-10-20 · Task: #33

Team → Settings lists every row of `setting_key`, so a key any lane adds by migration shows with no screen
change. Each field of a value comes from the JSON Schema the database checks values against: a whole
number, a switch, a choice, a tier (`tier_id`) or text. A field ending `_paise` is typed in rupees and one
ending `_basis_points` says so; labels come from the field's name. The database refuses anything else.

A change takes effect now or from midnight IST on a later day, like the Tiers screen. A money key (rake,
jackpot drop and shares) refuses "now" (RVMIN, #323), and the screen points to the Rake screen for a time
today. A change not yet in force can be withdrawn.

Super admins edit the venue configuration and the chips. Chips needed only `settings.manage` until now;
they now take `venue.configure`, because a chip's value decides what every cage count adds up to. Every
change is in the audit log. The logo upload needs a storage bucket and a file picker, and moves to #397.
