# 0574: A member asks to delete their account; a super admin completes it

Both app stores require a member to be able to start deleting their account inside the app (#813). Decision 0207 kept erasure with a super admin, and that stands.

- **The request.** Profile's Delete my account says what happens and files one open `member_erasure_request`. A super admin finds it on Members, opens the record and uses the existing erasure, which keeps its checks and is refused while anything is open.
- **The promise (the owner, 9 Nov).** Within 7 days once nothing is open. The website's `delete-account` page says the same and points to the WhatsApp and phone links at the top of the page; it has no form, as a form would be a new public write path.
- **The done message.** Erasure wipes the number and clears the member's outbox, so the number moves to `private.erasure_notice_phone`, which no export reads, and `account_erased` is emitted after the erasure. This changes 0207: the number outlives the erasure, for this message only.
- **Kept narrow.** `message_recipient` is untouched, so every other message still finds no number. Only the WhatsApp consumer's `account_erased` branch reads `erased_member_notice_phone`, service role only, never for the practice venue.
- **Forgotten within 48 hours.** An hourly job clears a number kept for a day. The message itself is dropped after six hours (decision 0303).
- A member erased without asking has no request, so their number is not kept and no message goes.
- `member_erasure_request` has row-level security and no policies, by design: it is read and written only through the permission-checked functions, as `top_up_request` is.
