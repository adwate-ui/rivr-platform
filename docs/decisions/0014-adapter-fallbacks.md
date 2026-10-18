# 0014 Which adapter a venue gets when credentials are missing

Date: 18 Oct 2026

`docs/engineering/stack.md` says fakes stand in for any vendor whose keys have not arrived. For most vendors a stand-in is harmless: a WhatsApp message or a Meta event that is not sent loses nothing. For two it is not. A fake payout provider would mark a real withdrawal "sent" with an invented UTR, and fake KYC would verify a person nobody checked. CLAUDE.md says to take the safest reading where money or identity is involved.

Decision: `createAdapters({ isPracticeVenue, live })` gives the practice venue fakes for every adapter, whatever is configured, so nothing from it reaches a vendor. A real venue gets the live adapter wherever one is configured. Otherwise:
- `upiPayouts` and `kyc` fail closed with `not_configured`. The cage pays by hand and enters the UTR; staff review KYC documents by hand.
- A social channel without credentials falls back to download-and-post.
- Every other adapter falls back to its fake.

A non-production environment that wants the fake payout or KYC adapter for a real venue passes it in `live` explicitly. This deviates from the Lane 0 brief ("any adapter without live credentials falls back to its fake") for those two adapters only, and needs a `question` issue for the reviewer session to confirm.
