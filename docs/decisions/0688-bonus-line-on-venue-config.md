# 0688 The Bonus card's line lives on the venue's configuration

Date: 17 Nov 2026. Issue #1065. The owner: the Bonus card's line ("Use with your buy-in") is editable from Content.

- **Where.** `venue_config.bonus_line`, null for the app's own line. The table's audit trigger keeps every change in Activity and its freeze holds it; its change alert lists its own columns, so the line raises none.
- **Who.** Those who edit Content (`website.edit`), through `set_content_bonus_line` and `content_bonus_line`. `venue_config` itself stays the super admins' (`venue.configure`), so the calls are security definer and check the permission themselves.
- **Not a setting.** Settings are effective-dated, schema-checked and written by `settings.manage`; one line of copy needs none of that.
- **Members** read it with their Bonus (`my_bonus().bonus_line`), as they read the expiry days; nothing else of the venue's configuration reaches them.
- **The default** lives once, in `common.bonusLineDefault`, for the player's card and Content's hint.
