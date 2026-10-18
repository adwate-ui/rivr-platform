# 0034 The console's Academy screens, which the prototype does not draw

Date: 18 Oct 2026. Task #8.

The prototype's Growth → Academy is a list of drill results (spots, accuracy, points), and it has no screen for Academy batches, bookings or their payments. #8 needs both, so the console has two screens built from the existing `Screen`, form and list patterns, with no new layout:

- **Growth → Academy** (`members.manage`): open a batch, then each batch with its days, the seats taken as the database counts them, and its bookings. Book for a company, record a UTR the payer could not give in the app, cancel a booking with no payment given. "Open batch" is the screen's one gold button.
- **Money → Academy payments** (`cage.transact`): the UTRs payers gave, for the cashier to find in the bank. Placed under Money because it moves money into the ledger, as the cage does; the Cage screen (lane A) can absorb it later. Each row acts on the UTR it first showed and says when the payer changes it. Whoever recorded a UTR is never offered to confirm it.

The drill results the prototype shows under Academy come with Learn (lane C) and can sit beside the batches then.
