# 0683 A sign-in code not sent is refused with 424, never a 5xx

Date: 17 Nov 2026. Issue #1049, from Sentry RIVR-PLAYER-6. The owner approved the fix.

- **What happened, 16 Nov.** No code went out from 13:13 to 16:33 UTC, and the Send SMS hook answered `http_code` 502. Supabase's gateway repeats a request that Auth answers with a 5xx: the same `request_id` appears in Auth's log up to four times, while the browser saw one request. On production the repeat carried the CAPTCHA token the first try had spent, so Auth refused it with `400 captcha_failed` ("timeout-or-duplicate"). The app read that as `not_checked` and told members "Security check incomplete. Send again." instead of "Sign-in is down".
- **Staging differs.** Its Turnstile test key accepts a reused token, so each repeat ran the hook again: with VerifyNow, up to four texts per tap.
- **The rule.** Every refusal the hook gives Auth for a code not sent uses `CODE_NOT_SENT` (424, Failed Dependency): the hook's channel, keeping the code, Auth's code length, or a missing hook secret. 429 stays 429. Auth passes the status on with `code: "unknown"`, and the app reads it as `unavailable`. The gateway does not repeat a 4xx: Auth's log shows each 403 and 429 once.
- **Why a code was not sent** goes in the refusal's message, which Auth logs: the step (`send` or `keep`) and the vendor's reason, never the number or the code. Functions log nothing (`no-console`), so Auth's log is the only record.
- **Not covered.** A hook signature that fails gives Auth a bare 401. Auth then answers 500 on its own account, which is still repeated and on production still shows as the security check. The hook cannot answer an unverified caller with a body.
