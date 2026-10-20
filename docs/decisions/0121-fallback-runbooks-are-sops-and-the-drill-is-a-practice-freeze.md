# 0121 The fallback runbooks are SOPs, and the outage drill is a freeze of the practice venue

Date: 20 Oct 2026. Task #52.

Scope-v1 module 11 asks for runbooks for app down, Wi-Fi down, power cut, UPI down and KYC vendor down, each with its paper form and the step that brings the paper back. Its acceptance test is a 30-minute outage that reconciles with no lost buy-in.

- **SOPs.** The five runbooks join the training set in every venue's SOP library (`add_training_sops`, #51). Staff read and acknowledge them on the console like any SOP, and the duty manager owns them. `docs/runbooks/paper-fallback.md` holds the same steps, the printable forms and the drill.
- **No new tables.** Paper goes back through the functions staff already use: seating, the cage's buy-in, the deposit confirmation, the identity check in person.
- **Nothing lost.** The cage paper log numbers every slip. After the outage the duty manager checks three things: every slip is ticked as entered, the numbers have no gap, and the slips add up to the cash taken. A slip left out shows at the end of day as cash over. In the drill no hands are logged while the slips go in, so the flow also checks that Treasury's chips in play rose by exactly the log's total.
- **What waits for the system** (the safest reading, question #402):
  - Cash-outs are not written on paper, because one could not be brought back without a false early departure or the TDS the system works out. A player's chips stay with them.
  - A UPI payment made in an outage waits on the UPI sheet until the member records it in the app.
  - A player seated on paper has their call time counted from their entry. An admin lets them go early, with the floor sheet's time as the reason.
  - Tablets keep logging through Wi-Fi and server outages, and a hand sheet is only for a tablet that has died.
- **The drill.** The outage is a venue freeze in the practice venue. The features spec already says the paper fallback applies while a freeze is on, a freeze refuses everything a real outage would stop, and the practice venue keeps the club's records clean. The "Paper fallback" flow plays it end to end: freeze, a refused seating, paper, release by two super admins, then the slips seated and entered.
