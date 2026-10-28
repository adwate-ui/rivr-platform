# 0280: Channel analytics beside the growth funnel

Date: 28 Oct 2026. Issue #164; tech plan item 11.

- **Counted nightly.** The Edge Function `channel-analytics` runs at 00:00 IST and records each connected channel's follower count in `channel_metric`, one a night per channel. The counts are for the club venue in `SOCIAL_VENUE_ID`, never the practice venue.
- **Which channels.** Instagram, Facebook, X, LinkedIn, YouTube and Telegram, each once its secrets are set:
  - `INSTAGRAM_USER_ID`/`INSTAGRAM_ACCESS_TOKEN`;
  - `FACEBOOK_PAGE_ID`/`FACEBOOK_PAGE_TOKEN`;
  - `X_USER_ID`/`X_BEARER_TOKEN`;
  - `LINKEDIN_ORGANIZATION_ID`/`LINKEDIN_ACCESS_TOKEN`;
  - `YOUTUBE_CHANNEL_ID`/`YOUTUBE_API_KEY`;
  - `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHANNEL`.
  Google Business Profile and WhatsApp give no follower count, so they show as not counted.
- **Joined to the funnel.** Reports shows each channel's latest count, the change over 30 days, and the members who signed up from its links. A link counts when its `utm_source` names the channel, in any case, and it carries no referral or creator code, as the growth funnel (#166) counts a link. Then how many finished KYC and bought in. Referral and creator codes keep their rows in the growth funnel on the same report.
- **Not checked against the live services.** Each client follows its API's documents and is tested against fake replies. LinkedIn's `linkedin-version` header (202510) needs a supported month at setup.
