# 0582. The club's numbers are a setting

The owner, 12 Nov (#917): "make the numbers (for call and whatsapp) a setting in ops console, which can then be used throughout the website and the app". Until now one number lived in code (`CLUB_CONTACT`, decision 0540).

- **Where:** two fields among the club's details (`venue_config.contact_phone`, `contact_whatsapp`) under Settings, Club details: "Number to call the club" and "Number to WhatsApp the club". They sit with the club's other fixed details, not among the dated rules, because a number takes effect at once and has no effective date.
- **Who:** whoever changes the club's details (`venue.configure`, super admins). Every change is audited, and the owner is alerted (`venue.config_changed`), because a changed number could send members to someone else.
- **Values:** +91 and ten digits. The call number may be a landline, typed with or without its trunk 0. The WhatsApp number is a mobile. Either may be left empty, and a number left empty is not shown.
- **Who reads them:** anyone, signed in or not, through `public_club_contact`. It shows the club's two numbers and nothing else of its details, and never the practice venue's.
- **Where they are used:**
  - the website: the top bar, the WhatsApp reserve links, the map section's Call and WhatsApp, and the structured data's `telephone`;
  - the player app: Call the desk and WhatsApp the desk.

  A map section's own phone, set in the website editor, still overrides the call number there.
- **Offline:** the app keeps a signed-in member's copy with what it opens with offline (12 hours). Before the first read, the desk buttons wait rather than show a number from code.
- **Start:** the migration fills today's number (+91 87965 80435) for the club, so nothing changes until someone edits it. `CLUB_CONTACT` keeps only Instagram, YouTube and email.
