# 0170: The shareholding register holds shares in basis points from effective days

Date: 2026-10-26 · Task: #97 (additions "Shareholding register")

**Holders.** A shareholder is a partner or an investor, named. Holders belong to the club's venue, as every table does. The practice venue's register is for training and resets with it.

**Holdings.** A holding is a share in basis points (10000 is the whole club) from a day on, until that holder's next holding.
- The register on any day is each holder's latest holding from that day or before.
- A second holding recorded for the same holder and day replaces the first. The audit log keeps both.
- The holdings can never come to more than 100% on any day. A change on an earlier day that would push a later day over 100% is refused too.
- The console takes a share as a percentage with up to two decimals, read as basis points without floating point.

**Who.** A new permission, `shareholding.manage`, is held by super_admin only. It is on the list of permissions no other role may ever hold: the code's `SUPER_ADMIN_ONLY` list and the database's own check on `role_permission`. Where a venue keeps money work to its computers (#384), it is held to the admin computer. Changes are refused while the venue is frozen. Every change is audited by the row triggers. Nobody else sees the register.

**Next.** The monthly partner and investor statement (#98) reads holdings from this register on the month's last day.
