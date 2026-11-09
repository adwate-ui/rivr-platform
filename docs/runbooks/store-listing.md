# Store listing and going live

Everything Google Play and the App Store need that is not an account or a key. Decisions 0361, 0574 to 0577.

## 1. Put the keys in place

Put these in `~/rivr-secrets/store/` in WSL (mode 600), then run `scripts/github/store-secrets.sh --check`. It lists what is there and changes nothing.

| File | What it is | Where it comes from |
|---|---|---|
| `android-upload.keystore` | The Android upload key | `keytool -genkeypair`, kept for good: losing it needs a Google key reset |
| `android.env` | `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | Chosen when making the key |
| `play-service-account.json` | Uploads builds to Play | Play Console, Setup, API access |
| `google-services.json` | The Firebase app, package `club.rivr.player` | Firebase console |
| `fcm-service-account.json` | Sends Firebase messages | Firebase, Project settings, Service accounts |
| `asc.env` | `ASC_KEY_ID`, `ASC_ISSUER_ID`, `APPLE_TEAM_ID` | App Store Connect, Users and Access, Integrations |
| `asc-key.p8` | The App Store Connect API key, Admin role (automatic signing may refuse App Manager) | Downloaded once, with the ID above |
| `apns.env` | `APNS_KEY_ID`, `APNS_TEAM_ID` | developer.apple.com, Keys |
| `apns-key.p8` | The Apple push key | Downloaded once, with the ID above |
| `reviewer.env` | `STORE_REVIEWER_NUMBER` (+91 number), `STORE_REVIEWER_CODE` (six digits) | A number the club controls and no one uses, as WhatsApp notices go to it |

With `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROD_REF` in the environment, run `scripts/github/store-secrets.sh`. It refuses a reviewer number that is a staff member or any existing member, and sets the fence before the fixed code. `PROD_PLAYER_URL` must be set, as the store builds load it.

## 2. Go live

1. Create the Play app and the App Store Connect record, both `club.rivr.player`. Register the widget's id `club.rivr.player.RivrLiveStatus` too.
2. Land the three batches, then push a `release-*` tag and approve `production` at each of its three stages: the database and the key check, then the web apps and the tablet's APK, then the two store builds.
3. The first Android upload may have to be by hand: build the bundle, and add it to Internal testing in Play Console. Later ones go by the release.
4. Confirm `kyc.at_the_club` is on for the club: the privacy answers below assume it.
5. Sign in with the reviewer's number, sign up as "App Review", and take the selfie.
6. Install from TestFlight and Play's internal track. On real phones, check: the selfie, the lock-screen status, a push with the app closed, a tap on one, alerts stopping after sign-out, and Delete my account.
7. Fill in both consoles from section 3 and submit. After approval, erase the reviewer account's selfie.

## 3. What to enter

**Name:** RIVR. **Subtitle (Apple):** Members' poker club, Gurugram. **Category:** Lifestyle. **Age:** 18+. **Price:** free. **Availability:** India.

**Short description (Google, 80 characters):** Waitlist, call time and your membership at RIVR Poker Club, Gurugram.

**Keywords (Apple):** RIVR,poker club,Gurugram,members,waitlist,table,membership

**Full description:**

> RIVR is the app for members of RIVR Poker Club in Gurugram.
>
> See the games tonight and join a table's waitlist. Know your place in line from the lock screen, and answer when your seat is ready. Keep track of your call time while you play, and order food and drink to your seat. Show your membership card at the door.
>
> For members of the club, aged 18 and over. No money moves in the app, and no game is played in it.

**Support:** info@rivrpoker.com. **Marketing:** https://rivrpoker.com. **Privacy:** https://rivrpoker.com/privacy. **Account deletion (Google's Data safety form):** https://rivrpoker.com/delete-account.

**Review notes:**

> RIVR is the app for members of a poker club in Gurugram, India. It shows waitlists, seat calls and call time, and takes food and drink orders. No money moves in the app and no game is played in it. Play happens in person, at the club.
>
> Sign-in codes go by WhatsApp. To sign in, enter the number and code given in this section. [Enter the reviewer's number and code here, from `reviewer.env`.]
>
> The lock-screen status appears once a member joins a waitlist. To delete an account: Profile, then Delete my account.

**Art:** `docs/brand/store/`: `app-store-icon.png` (1024), `google-play-icon.png` (512), `google-play-feature.png` (1024 by 500), and `screenshots/`. To shoot again, see `e2e/flows/store-screenshots.spec.ts`.

## 4. Privacy answers

From what the code collects today, with `kyc.at_the_club` on. Answer again if KYC goes back to the app, or analytics or the ad jobs are turned on.

| Data | Collected | Why |
|---|---|---|
| Phone number | Yes | Sign-in, and messages from the club |
| Name | Yes | The membership |
| City and occupation | Yes, at sign-up | The membership |
| Selfie, and any photo added | Yes | Identity at the club |
| Play times, waitlist and seat history, games | Yes | Running the club's tables |
| Food and drink orders, feedback | Yes | Service |
| How the member found the club (referral, campaign) | Yes | The membership |
| Push tokens | Yes | Notifications |
| Aadhaar and PAN | Not in the app | Checked at the desk |
| Location, contacts, payments | No | |

**Tracking:** none in the app, so Apple's App Tracking answer is No. No Google Analytics or Meta pixel loads in the store app (decision 0577), and the server's Meta and Google Ads conversion jobs are off (`20261110402000_unused_jobs_off.sql`). If either job is turned back on, this answer becomes Yes and the app needs Apple's permission prompt first. The website's privacy notice still describes those reports: make it agree with this answer before submitting.

**Sold:** no. **Deletable:** yes, in the app and at the page above.

**Shared with, to run the service:** Supabase (database and sign-in), Cloudflare (hosting), WhatsApp, through Evolution API hosted by Elestio (messages), MSG91 (codes by SMS when WhatsApp cannot), Google Firebase and Apple (push).
