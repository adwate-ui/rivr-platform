# 0625. One rule for the notice that shows

Joining the redesign's three branches. Home's top slot (RD-20) and the foot of the TVs' boards (RD-28) each show one club notice, and each branch chose it for itself: Home in `@rivr/domain` (`homeTopSlot`), the TV in its own query (`tv_notice`). The specification gives one rule, correction 20: the notice that started last. The TV's migration says its notice is "the one a member's Home shows".

- **One rule, `noticeToShow` in `@rivr/domain/notices`:** of the notices in force, the one that started last; of two that started together, the one listed first.
- **One twin, `private.notice_to_show`,** proved with it on `packages/testing/golden/noticeToShow.json` (`024_golden_twins`).
- **One listing, `private.notices_in_force`:** started last first, and of two that started together the one made last. `my_notices` and `tv_notice` both read it, so "listed first" means the same notice on a phone and on a TV. Before, Home's list had no order among notices that started together, and the two could show different ones.
- **Who reads what is unchanged:** a member their own club's notices behind `notices.view`; a paired TV its own venue's.
