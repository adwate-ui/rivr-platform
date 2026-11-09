# 0572. A permission for TVs alone

Date: 9 Nov 2026. The owner's answer on #656 (3 Nov).

`tvs.manage` lets Floor and Cashier, as well as super admins and admins, pair a TV, choose what it shows and unpair it. `devices.manage` stays with super admins and admins, as it also enrols the cage's computers and keeps the cameras: a cashier could otherwise switch off the cage camera. Floor and Cashier see Settings with its TVs tab alone. Like other floor work it needs no enrolled computer, so an admin or super admin doing TV work needs none either. During a venue freeze a TV cannot be unpaired, as other direct writes are refused, so it stays on the "club closed" screen; a super admin still can.
