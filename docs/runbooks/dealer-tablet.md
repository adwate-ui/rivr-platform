# Setting up a dealer tablet

Each dealer tablet runs only RIVR Dealer, locked to it (Android lock task, #41): no home button, no recent apps, no notifications and no other app. It opens RIVR Dealer by itself after a restart. The app is a shell around the hosted tablet bundle, so screens and fixes reach the tablet without touching it; the APK changes rarely.

For this the app must be the tablet's **device owner**, which Android allows only on a tablet with no accounts on it, set once over a USB cable. Allow about ten minutes per tablet.

## You need

- The tablet, charged, and a USB cable.
- The cage computer with `adb` (Android platform tools).
- The latest `rivr-tablet-release-….apk` from the GitHub release (Releases, Assets).
- The console, signed in as someone who manages devices (Tablets).

## Steps

1. **Reset the tablet.** Settings → System → Reset → Erase all data. During setup, skip the Google account and every other account: Android refuses a device owner once an account exists.
2. **Turn on USB debugging.** Settings → About tablet → tap Build number seven times; then Settings → System → Developer options → USB debugging on. Connect the cable and accept the computer's key on the tablet.
3. **Install the app.** On the cage computer:
   ```
   adb install rivr-tablet-release-20261115-1.apk
   ```
4. **Make it the device owner.**
   ```
   adb shell dpm set-device-owner club.rivr.dealer/.DealerAdminReceiver
   ```
   It prints `Success: Device owner set to package club.rivr.dealer`. "Not allowed to set the device owner because there are already some accounts" means step 1 left an account: reset again.
5. **Open RIVR Dealer once.** It locks the tablet to itself and asks for a pairing code. Restart the tablet and check that it opens RIVR Dealer by itself.
6. **Turn USB debugging off** (before step 5, from Developer options, or leave it: the locked tablet cannot reach Settings, so it stays as it was). Off is safer: with it on, anyone with a cable and an unlocked computer can reach the tablet.
7. **Pair it and fix it to its table.** On the console, Tablets: add the tablet by name, read out its six-digit code, type it on the tablet, then choose its table.

## Later

- **A new APK** (rare; the release notes say when): a locked tablet with USB debugging off is set up again from step 1. With USB debugging on, `adb install -r` the new APK.
- **A lost or broken tablet:** revoke it on the console (Tablets). Its session stops at once and its table is freed.
- **Using the tablet for something else:** reset it (step 1); that also removes the device owner.
