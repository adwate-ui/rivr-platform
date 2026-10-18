# 0033 A member always sees their own Academy bookings

Date: 18 Oct 2026. Task #8.

Booking a seat, seeing the open batches and being shown where to pay are gated by tier (`academy.booking`), in the database and in the app. A member's own bookings are not: the "members see their own bookings" policy and `my_academy_bookings()` skip `has_feature`. A booking is a record of the member's money, and a tier change must not hide what they paid or are waiting on.

In the app the Academy screens sit behind `FeatureGate`, so a member who loses the feature sees the locked notice. Staff record the UTR of anything such a member has paid (`record_academy_payment`), and the cashier confirms it as usual.

A member's bookings are read through `my_academy_bookings()`, never the `academy_booking` table. A member who is also staff would otherwise get the venue's bookings through the staff policy. The function returns only the member's own seats (`kind = 'individual'`); a corporate booking is the company's, not its contact's to pay.
