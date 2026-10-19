# Setting up a dealer tablet

Each dealer tablet runs only RIVR Dealer, locked to it (Android lock task, #41): no home button, no recent apps, no notifications, no Settings and no other app; restarting into safe mode is blocked. It opens RIVR Dealer by itself after a restart, and installs system updates only between 11:00 and 15:00. The app is a shell around the hosted tablet bundle, so screens and fixes reach the tablet without touching it; the APK changes rarely. As the spec says, the APK is installed and updated by ADB from the cage computer, so USB debugging stays on.

For this the app must be the tablet's **device owner**, which Android allows only on a tablet with no accounts and one user, set once over a USB cable. Allow about ten minutes per tablet. Once locked, the tablet's own settings cannot be reached, so do everything in steps 1 to 3 first.

## You need

- The tablet, charged, and a USB cable.
- The cage computer with `adb` (Android platform tools).
- The latest `rivr-tablet-release-….apk` from the GitHub release (Releases, Assets).
- The club Wi-Fi name and password.
- The console, signed in as someone who manages devices (Tablets).

## Steps

1. **Reset and set up the tablet.** Settings → System → Reset → Erase all data. During setup:
   - Join the club Wi-Fi.
   - Skip the Google account and every other account: Android refuses a device owner once an account exists.
   - Skip the screen lock (no PIN, pattern or password): with one, every restart stops at the lock screen until someone types it.
2. **Turn on USB debugging.** Settings → About tablet → tap Build number seven times. Then Settings → System → Developer options:
   - USB debugging on.
   - "Disable adb authorization timeout" on (otherwise Android forgets the cage computer after seven days without a connection, and a locked tablet cannot show the prompt to approve it again).

   Connect the cable to the cage computer; on the tablet, tick "Always allow from this computer" and allow. Only a computer approved here can reach the tablet over ADB.
3. **Landscape.** Hold the tablet in landscape and turn auto-rotate off in the quick settings. (Android 16 decides orientation on tablets itself; once locked, nobody can change it.)
4. **Install the app.** On the cage computer:
   ```
   adb install rivr-tablet-release-20261115-1.apk
   ```
5. **Make it the device owner.**
   ```
   adb shell dpm set-device-owner club.rivr.dealer/.DealerAdminReceiver
   ```
   It prints `Success: Device owner set to package club.rivr.dealer/.DealerAdminReceiver`. If it says:
   - "there are already some accounts": step 1 left an account. Reset again.
   - "there are already several users": a guest user or a secure folder exists. Remove it, or reset again.
6. **Open RIVR Dealer once, and check it.** It locks the tablet to itself and asks for a pairing code. Then check:
   - Home, Recents and Back do nothing; pulling down from the top shows nothing.
   - Holding Power shows Power off and Restart; a long press on Power off does not offer safe mode.
   - Restart the tablet: it opens RIVR Dealer by itself, still locked.
7. **Pair it and fix it to its table.** On the console, Tablets: add the tablet by name, read out its six-digit code, type it on the tablet, then choose its table.

## Later

- **A new APK** (rare; the release notes say when): connect the cable at the cage and `adb install -r rivr-tablet-release-….apk`. The app restarts, locked.
- **The Wi-Fi password changed:** connect the cable and `adb shell cmd wifi connect-network "<name>" wpa2 "<password>"`.
- **A lost or broken tablet:** revoke it on the console (Tablets). Its session stops at once and its table is freed.
- **Using the tablet for something else, or starting again:** a locked tablet cannot open Settings. Connect the cable and `adb reboot recovery`, then choose "Wipe data/factory reset". Without ADB, use the maker's recovery key combination (often Power and Volume up while it starts). A reset also removes the device owner.
