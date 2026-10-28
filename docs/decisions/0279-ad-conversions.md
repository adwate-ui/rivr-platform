# 0279: Ad conversions to Meta and Google Ads

Date: 28 Oct 2026. Issues #161 and #162; scope-v1 "Growth", and the 14 Oct additions' "Resolved conflicts" (Google enabled, not behind a flag).

- **Which events.** The database names each conversion (`private.conversion_for`). An Academy booking, KYC complete, a tournament entry; a visit, as the member's first or a repeat visit; and a buy-in, only the member's first. Only for a member who consented to marketing and is not erased, never at the practice venue.
- **Two consumers, one rule.** `meta-conversions` and `google-ads` are separate outbox consumers, so each retries on its own. Both use `createConversionConsumer` in `@rivr/adapters/conversions`, which finishes unsent an event older than seven days.
- **Meta.** The Conversions API, `action_source` `physical_store`, the phone and member id hashed. Meta's standard Schedule and CompleteRegistration events; custom FirstVisit, FirstBuyIn, TournamentEntry and RepeatVisit. Function secrets: `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`.
- **Google.** The offline conversion import with the phone hashed (no click id: members come from a store). Each kind needs its own conversion action, given as JSON in `GOOGLE_ADS_CONVERSION_ACTIONS`. Also: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID` and, through a manager account, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`.
- **Until the secrets are set** each function answers 503 and claims nothing, so conversions wait in the outbox. Only the last seven days' are sent once the secrets arrive.
- **Not checked against the live services.** Both clients follow the vendors' documents, and are tested against fake replies. Check the first events in Meta's Events Manager and Google's conversion diagnostics. The Google Ads API version (`GOOGLE_ADS_API_VERSION`) is retired about a year after release, so confirm it at setup.
