# 0324: A call time already met takes no more

Date: 3 Nov 2026. Add time is a request the floor approves (decision 0320). The money audit found that approving it after the call time had run out made a member owe time again: the cage refuses a cash-out until an admin records an early departure, the app puts a leaving member on the Leaving list, and the sweep sends no new warning or completion, as the session already counts as complete.

- **The rule.** A call time already met takes no more. Once it has run out (`call_time_completed_at` set, or none left), `request_call_time` refuses the request and `decide_call_time_request` refuses to approve one; the floor declines it instead. This keeps what two earlier paths hold: a player who met their call time never comes to owe time again (20261029170000, 20261101090200).
- **In the app.** Add time leaves the seat's actions once the call time has run out; the push's Add time opens nothing then.
- **Also closed.** A request still open when the seat ends closes as `left`, as a top-up does (#759). Members can no longer call `extend_my_call_time`: every minute added is the floor's approval (owner, 3 Nov).
- **Open.** Whether a member who met their call time may choose to commit to more is the owner's call (question issue); until then, no.
