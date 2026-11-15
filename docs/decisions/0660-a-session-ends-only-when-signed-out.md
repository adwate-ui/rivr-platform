# 0660. A session ends only when someone signs out

The owner, 15 Nov night: "Stop signing out idle players and staff" and "Login should never expire." The console's idle lock (#384, decisions 0110 and 0282), which signed staff out of Members, ID checks and Activity after ten idle minutes, is removed, with the line sign-in showed after it. A staff member or a member stays signed in until they press Sign out. The hosted Auth settings already end no session by time or inactivity; `jwt_expiry` stays at an hour, as the access token renews itself.

What else can end a session, and why each stays:

- **A member's number changed by staff** (`change_member_phone`) ends that login's sessions: the number is the login, and the change is made for a lost or stolen phone.
- **A member erased** on request deletes the login itself.
- **A TV unpaired** on the console signs that TV out, and **a tablet paired** drops whatever session the tablet had before: device logins, not a person's.
- **A sign-in whose link to the member or staff record fails** is undone at once, so nobody is signed in as no one.
- **Auth's refresh token reuse detection** ends a session whose refresh token is replayed more than ten seconds after use, a sign of a stolen token.

`.claude/rules/security.md` still says the console signs staff out after ten idle minutes; that line is for the owner to change.
