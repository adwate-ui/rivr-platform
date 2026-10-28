# 0268: The social inbox

Date: 28 Oct 2026. Issue #156. Question #585 asks how to link by handle.

- Meta delivers Instagram, Facebook (Messenger) and WhatsApp messages to the `social-inbox` Edge Function by webhook.
  - A delivery is read only when its `X-Hub-Signature-256` is the app secret's HMAC of the body.
  - Meta's subscription check is answered with its challenge for the verify token.
  - Until `META_APP_SECRET`, `META_VERIFY_TOKEN` and `SOCIAL_VENUE_ID` are set, the function answers 503.
- Each conversation is a lead with its messages. A message Meta sends again is kept once. The practice venue is refused.
- A WhatsApp lead is linked to the member with the sender's number, either at once or when that number signs up or becomes a member's on a phone change. When a member's number changes, their conversation on the old number is closed and stays theirs; a later message from that number opens a new lead for whoever holds it then.
- Instagram and Facebook leads carry only the sender's id. Members have no social handle on record, so these leads are not linked yet; the question above asks how to link them.
- Staff who publish marketing read the leads in the console's Social screen (#587): channel, sender, first and last message, how many messages, and the member each became. Replies happen in the app the message came in.
- A member's erasure deletes the leads linked to them and those leads' messages. Unlinked leads have no retention limit yet.
