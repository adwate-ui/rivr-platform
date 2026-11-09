# 0577: The store builds

The owner asked for everything but the accounts and keys to be ready, so that going live is adding the keys and tagging a release (#806).

- **A release builds them.** A `release-*` tag builds the player's signed bundle for Google Play's internal track and an iPhone build for TestFlight, after the web apps have deployed, so a failed store build cannot hold up the web app.
- **Keys stay out of reach.** Each signing key reaches only the step that signs, after the build and `cap sync` have run, so nothing they install can read it.
- **Keys decide.** The `store-keys` job looks at each build's keys. None set is a notice and a skip, so releases carry on before the accounts exist. Some set is a failure naming the missing ones. The tablet's APK follows the same rule, which ends its red release job while no signing key exists.
- **Hosted, as 0361.** The app loads the hosted player app. `offline.html`, built into the app as the tablet's is, shows when that cannot load.
- **No analytics in the store app.** The cookie sheet and the Analytics switch are left out inside the native app, and Google Tag Manager never loads there. Google Analytics and the Meta pixel inside an app would be tracking, which needs Apple's permission prompt and a declaration. The web app and website keep their cookie choice. To add it to the app later, build the prompt first. The server's Meta and Google Ads conversion jobs are off too (`20261110402000_unused_jobs_off.sql`), and turning them on needs the same.
- **One script sets the secrets.** `scripts/github/store-secrets.sh` reads the files in `~/rivr-secrets/store/`, keeps every value off command lines and out of its output, and sets the reviewer's fence before the fixed code. The release check fails if Auth lists the reviewer's number and the setting does not match (decision 0575).
- **Not proven until the keys exist.** Real signing, both uploads and the first iPhone compile.
