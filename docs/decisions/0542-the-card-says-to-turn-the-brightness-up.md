# 0542: The card says to turn the brightness up

Date: 2026-11-08 · Task: audit 8 Nov, F-182 (fix tracker PR-29)

The player brief (section 3.7) says the Card screen has no caption. Finding F-182 asks for a muted "Turn your brightness
up." under the QR once a session, and a sign that the code is live. The owner approved all the findings.

The finding wins for this one line. A web page cannot raise the phone's brightness (the Screen Wake Lock API only keeps
the screen on), so asking the member and showing the 30 second bar are the only ways to help the door read the code.

The brief's rule otherwise stands: nothing else sits under the card, and "Show at the door." stays gone.

The session's flag is set only when the hint is drawn with the card. Opening Card offline, or while it loads, does not use
it up.
