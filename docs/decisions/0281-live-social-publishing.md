# 0281: Live publishing per social channel

Date: 28 Oct 2026. Issue #586, the follow-up decision 0269 named.

- **Connected is the club's word.** A channel goes out by itself only when the venue setting `social.connected_channels` names it and its secrets are set. With the setting unset, publishing is as before: every channel offers the image and caption to download and post.
- **Sending.** A connected channel's row starts as `sending`, and the post emits `social.post_published`. The outbox consumer `social-publish` sends the image (from the public `social-media` bucket) and the caption to each sending channel, and records the post's link (`published`).
- **Falling back.** A refusal (a caption too long for Telegram, a PNG for Instagram, a bad token) puts that channel back to download and post. So does a channel named in the setting whose secrets are missing. An outage is tried again with the delivery, without resending the channels already done, and the last attempt falls back too.
- **Never twice.** Once a channel has taken the post, it counts as published even if its link cannot be read: the account (or Page, or channel) stands in for the link.
- **Switched off means not sent.** A venue freeze, or social publishing switched off after the post was made, stops the send: its channels fall back to download and post.
- **Live targets.**
  - Instagram (content publishing): `INSTAGRAM_USER_ID` and `INSTAGRAM_ACCESS_TOKEN`, as the social wall's, with `instagram_content_publish`.
  - A Facebook Page: `FACEBOOK_PAGE_ID` and `FACEBOOK_PAGE_TOKEN`.
  - Telegram, through the club's bot as a channel admin: `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHANNEL`.
  X, LinkedIn, YouTube (video only), Google Business Profile and WhatsApp marketing stay download and post: each needs an upload flow or account approval beyond a token. Each is a target to add when the club wants it.
- **Never from the practice venue.** Its posts are always download and post, and it emits no event.
- **Not checked against the live services.** Each target follows its API's documents and is tested against fake replies. Check the first post on each channel.
