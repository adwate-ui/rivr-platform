# 0162: The membership card's QR is a code for a time window, made and checked in the database

Date: 2026-10-20 · Task: #71

The card's QR holds three things: the card's id, when its time window began (`card.qr_rotation_seconds` long, 30 unless set) and a MAC of both. The MAC uses a key kept in Vault, as the KYC reference key is, so neither a phone nor a backup can make a code. The player app asks for the code for now with how long it has left by the database's clock, and asks again when that time is up. It times this from when the code arrived, so a phone whose clock is wrong still asks on time. No table of issued codes grows as members watch their card.

The door checks the MAC and the window. A code is refused (`RVCRD`) more than five seconds after its window ended, so a code scanned as it changes still works and a screenshot does not. A code names its window by when it began, so changing the setting does not break a code already on screen.

The door's scanner types what it reads into the Check-in screen's card field and presses Enter, as a keyboard does, so no camera library is needed. `QrCode` in `@rivr/ui` draws the QR with `uqr` (MIT) at medium error correction. A rendered card image (`card.membership`, decision 0160) never carries a code.
