# 0269: Publishing, and download-and-post until a channel is connected

Date: 28 Oct 2026. Issue #154.

- Staff who publish marketing compose a post in the console's Social screen: one image (JPEG, PNG or WebP) and its caption. They choose its channels from Instagram, Facebook, X, LinkedIn, YouTube, Telegram, Google Business Profile and WhatsApp marketing. Every channel is chosen at first.
- The image is kept in the public `social-media` bucket at `<venue>/<file>`, since it is published anyway. Only staff who publish marketing at that venue upload there.
- A channel without the club's credentials offers the image and the caption to download and post by hand. No channel has credentials or a live client yet, so every channel does that today.
- Publishing through each channel's API needs that channel's credentials. That follow-up (#586) adds a consumer and a live client per channel, and each connected channel then moves from "download and post" to "published", with the post's link.
- Switching social publishing off stops new posts. The practice venue publishes the same way, and nothing leaves the club.
