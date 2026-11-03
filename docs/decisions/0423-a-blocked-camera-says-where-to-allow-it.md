# 0423: A blocked camera says where to allow it on this phone

Date: 3 Nov 2026. A tester's selfie on staging showed "Camera blocked. Allow it in site settings." without the browser ever asking. The owner: "Identify the cause and fix."

- **Why no prompt.** The browser answered NotAllowedError at once: a deny it had kept, the browser's own or the iPhone's for that browser app (Chrome on an iPhone, by the screenshot). The app asks once when the step opens and cancels nothing, so the deny was already there. No page can make a browser ask again; only the person can lift it.
- **What changes.** CameraCapture's blocked message (and SelfieCamera's, which uses it) names the place for the device in hand, read from the user agent:
  - A browser on an iPhone or iPad: "Camera blocked. In Settings, search for {browser} and allow Camera, then come back here." The browser is Chrome, Edge or Firefox when the agent names one, Safari when it carries both Version/ and Safari/. Search finds the browser on every iOS, including iOS 18, where apps moved under Settings → Apps.
  - A browser on Android: "Camera blocked. Tap the icon left of the address, then Permissions, allow Camera and tap Try again."
  - Everything else keeps "Camera blocked. Allow it in site settings.":
    - the installed app, which has no address bar (display-mode standalone);
    - an app's own browser, such as Instagram's, Google's, or an Android web view (`; wv)`);
    - a computer.
- **Not done.** No file or photo-library fallback: a KYC photo is taken there and then (K-07).
