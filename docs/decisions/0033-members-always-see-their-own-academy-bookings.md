# 0033 A member always sees their own Academy bookings

Date: 18 Oct 2026. Task #8.

Booking a seat, seeing the open batches and being shown where to pay are gated by tier (`academy.booking`), in the database and in the app. A member's own bookings are not: the "members see their own bookings" policy and `my_academy_bookings()` skip `has_feature`. A booking is a record of the member's money, and a tier change must not hide what they paid or are waiting on.

The app shows the same (the owner's answer to #231, task #248). Without the feature, the Academy screen lists the member's own seats to read only: no way to pay, no pay-by line and no change of UTR, with the locked notice where the open batches would be. Learn links to the Academy only with the feature, so Profile, which every tier has, links to it for any member with a seat. The screen waits until access is known (`useFeatureStatus`) rather than switching views once it arrives. Staff record the UTR of anything such a member has paid (`record_academy_payment`), and the cashier confirms it as usual.

A member's bookings are read through `my_academy_bookings()`, never the `academy_booking` table. A member who is also staff would otherwise get the venue's bookings through the staff policy. The function returns only the member's own seats (`kind = 'individual'`); a corporate booking is the company's, not its contact's to pay.
