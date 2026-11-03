# 0451: Console v3 screens keep the copy rules over the prototype

Date: 3 Nov 2026. Console v3, phases 4 and 5: Door, Members, KYC review, Host queue, Feedback, Food and drink, Rewards, Spin wheel, Social and Content.

- **No line under a heading.** The prototype puts an intro sentence under every screen's title ("Lapsed regulars, longest gone first…"). The copy rules forbid a subtitle unless a field cannot be filled without it, so none is kept.
- **Labels stay visible** where the prototype has placeholders only; a hint folds into the label ("Bonus chips, in 50s", "Name, member no. or mobile").
- **One gold button per screen**, decision 0429. KYC review's is Check in person, so Approve is cream; Food and drink's is New order, and Send to the bar is gold only inside its sheet; a waiting spin's Spin is cream, since several may wait.
- **Tabs that the frame does not own**: Food and drink (`?tab=orders|menu`), Feedback (`?tab=open|resolved`) and Social (`?tab=wall|publish|leads`) keep their tab in the address. Rewards' parts sit under the frame's Rewards tab as `?tab=rewards&part=catalogue|handover|points`.
- **Lists to open from** (KYC review, Host queue, the website's pages) are a `PickList` beside the item open, half each (`SplitView layout="even"`); on a phone the item is its own view with a way back.
- **Statuses** are a `DotStatus`: gold only where the row needs someone (waiting, a post to approve), never for Live or Playing.
- **On a phone** Members' and the wheel's tables scroll sideways under their first column; Today's players leaves out In and Out there, as the scroll layout wraps cells inside its 640 px line. Food and drink's lanes are regions named by small-capital titles, as no heading has that look.
