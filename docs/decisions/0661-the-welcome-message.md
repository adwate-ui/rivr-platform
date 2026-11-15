# 0661. The welcome message on WhatsApp

The owner, 15 Nov night: once sign-up is done, send "Hi {First Name}, congratulations on becoming a member of RIVR poker club. Your membership ID is: {X}."

- **When.** On `member.signed_up`, which `private.sign_up` emits for every new member: one who signs up in the app and a staff member who signs up as a member (20261109110000). It is the only way a member row is made.
- **Words.** The `member_welcome` utility template, word for word. {First Name} is the first word of the member's name; {X} is the member number as the app shows it (Profile's "Member number 1042"), digits only.
- **Once.** The event's idempotency key is `member.signed_up:<member>`, and an outbox delivery is one per event and consumer, so a member is welcomed once.
- **Opt-out.** RIVR has no WhatsApp opt-out. The one choice a member makes is Offers (marketing consent), which governs marketing templates only. The welcome is a utility message, like the seat call and the identity-check notices (decision 0303), so it goes to every new member.
- **Late.** A sign-up claimed more than six hours after it happened is not sent, as for notices (decision 0303). Without that, the first run after this ships would welcome everyone who joined in the last 30 days, the window a new event type replays.
- **Privacy.** The payload still names the member only. The consumer reads the first name and member number from `message_recipient` when it sends, with the phone, so no outbox row (which reports staff read) holds a name.
- **Practice.** Practice-venue events are never offered to a consumer, and `message_recipient` never reads a practice member (pgTAP 500).
