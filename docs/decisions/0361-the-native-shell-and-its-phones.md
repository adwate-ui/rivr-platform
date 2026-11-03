# 0361: The native shell and its phones

Date: 3 Nov 2026. Phase 2 of decision 0323 (#779), built to its lines by the simplest path.

- **The shell.** `apps/player` gains Capacitor (`capacitor.config.ts`, `android/`, `ios/`), around the hosted player app as the dealer tablet's APK is (`RIVR_SHELL_URL`). Its one native addition is the app's own LiveStatus plugin; no other Capacitor plugin.
- **The switch.** In the shell, Profile's "Notifications on this phone" and Tonight's seat-call offer turn the lock-screen status on and off (`usePhone`), as they do web push in a browser. Waiting and Seat ready go where seat calls go, Seated where call time goes (`wants_push`): no new feature key. Signing out ends it on the phone.
- **Phones.** `live_status_device`: one row per phone with its push token, saved by the signed-in member. Each save gives the phone a new 256-bit key, kept on the phone and as a hash in the database; a phone moves to another member only with its last key.
- **Android.** A Firebase data message, high priority, one collapse key; the app's own `FirebaseMessagingService` posts one ongoing notification with a chronometer counting down to the server's end, or removes it. Only a seat call sounds. Built here: `assembleDebug`.
- **iOS.** A Live Activity started by push-to-start, then updated and ended through its own token. iOS gives that token in a background launch with no web view, so the app reports it with the phone's key to `live-status-token` (service role, verify_jwt off): the one native call to the backend, never the database directly. Written, not built: it needs a Mac.
- **Vendors.** One adapter, `LiveStatusAdapter`: `createApnsLiveActivity` (ES256 provider token) and `createFcmOngoing` (service-account OAuth, RS256), fetch and Web Crypto only. A kind of phone without credentials is skipped.
- **Out, as issues.** Answering "I'm on my way" without opening the app; Call time ending's alert and the other pushes in the shell; the store builds, icons and release workflow.
