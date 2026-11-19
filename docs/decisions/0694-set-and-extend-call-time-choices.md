# 0694 Set and Extend call time from lists of their own

Date: 19 Nov 2026. Issue #1089. The owner, 19 Nov: the console still said "Add call time". It should read Set call time / Extend call time as the member app does, Extend should have its own setting, and a note should say Extend adds beyond the current end.

- **Two settings.** `call_time.add_choices` is shown as "Set call time choices". The new `call_time.extend_choices` is "Extend call time choices". Both take whole minutes from 1 to 1,440, up to twelve, with the same schema. None set is 30 minutes, 1 hour and 2 hours.
- **One rule picks the list.** `private.seat_time_choices(seat)` gives the Set list until the seat's call time is set (`call_time_set_at`), and the Extend list after. These all read it:
  - the open lengths (`call_time_choices_open`);
  - the member's own Set or Extend (`set_my_call_time`, RVCTC for a length not on the list);
  - the floor's (`add_seat_call_time`, 22023);
  - `my_seat`'s and `floor_seats`' `add_time_choices`.

  The floor reads the lengths with its seats now. `useAddTimeChoices` is gone, and the old `add_time_choices` RPC stays for consoles open across the release.
- **The floor.** One section, as in the app:
  - Before one is set it reads "Set call time". Its lengths are from now ("1 h"), any that would end too early are greyed with "Can't end before …", and the toast says "call time set, 1 h from now".
  - Once set it reads "Extend call time", with "+1 h" lengths and the note.
- **The note.** "Extend adds time beyond the current end." shows under the Extend list in Settings (a list field now shows its hint), on the floor's Extend and in the app's Extend sheet.
- **Starting as a copy.** The Extend list starts as each venue's Set list. The migration copies every `add_choices` row, whether past, in force or scheduled, with its date and author, and writes its minutes as numbers, so the two lists match until a manager changes either. This is a copy, not a fallback: `setting_at` reads one key, and Settings shows each key's own value.
