# 0576: The other pushes in the native app

The shell's web view has no web push (decision 0361), so a member in the store app heard a seat call and nothing else (#805). Call time ending, call time complete, the session reminder, withdrawals, tournaments, promotions and bonus chips now reach those phones as ordinary alerts.

- **A consumer of its own, `native-push`**, beside web push, so a retry here never sends a web push again and web push is unchanged. The same builder makes the words, and `native_push_targets` carries the same gates as `push_targets`: the kind turned on, the tier has it, never the practice venue.
- **A seat call is left out.** The live status already sounds it, so an alert would double it.
- **An iPhone** needs its APNs device token, since a push-to-start token cannot carry an alert. It is saved as `live_status_device.alert_token`, withheld from a member's export. An iPhone that has not given one yet is left out until the app next opens.
- **An Android phone** gets a data message, not a notification message as #805 said. The app's own service posts it, and that service already refuses a phone that has turned this off or signed out.
- **Signing out stops them on the phone.** iOS shows an alert with no app code running, so turning this off or signing out also unregisters the iPhone from Apple's pushes, even when the server could not be told. An alert token is on one row only, and a dead one leaves an iPhone's live status alone.
- **A repeat replaces.** A retried delivery shows once: Apple's collapse id and Android's notification tag are the push's own tag, and an Android phone stays quiet for an event it has shown. An iPhone alert expires after an hour, as the others do.
- **It waits for its keys.** `native-push` claims nothing until Apple's or Firebase's secrets are set.
- A member who keeps both the web app with notifications on and the store app gets each alert on both.
