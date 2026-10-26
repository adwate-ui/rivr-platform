# 0163: The leaving list counts down call time, and a TV turns to other boards in between

Date: 2026-10-26 · Task: owner request (26 Oct), part of #148

The owner asked for two things. First, the call time of a winning player who wants to go should reach the floor manager and then the TV, so the room sees which seats will open. Second, the TV should show the live promotions in rotation with its other content. The owner chose the "leaving list" reading.

A player tells the floor they want to leave, and the floor (`waitlist.manage`) marks their seat leaving (`seat_session.leaving_at`, and who marked it). The floor can take it back. The call-time clock does not change: the seat opens once the call time the player still owes (#78) is done, or at once where the table has none.

The Live floor's Leaving list shows those players, soonest seat first. The TV's call-time board shows the same seats as "Seats opening", counting down between reads. Beside them it shows every table's players still on call time, as a first name and initial, or only the seat for a member who hid their name (#326).

A TV keeps one main mode and gains `tv_screen.rotation`: the boards it turns to after the main one, in order, each named once, never the main one, at most eight. The console offers the boards built so far. Each board shows for half a minute. The promotions show one after another and then move on, and are skipped when none is live.

A TV reads a board's names only while that board is its main mode or in its rotation (`private.tv_showing`).
