# 0606 Who changes the food and drink menu

Date: 15 Nov 2026. Issue 976 (redesign RD-33; the owner, 15 Nov: "staff hide an item, only admins add or delete").

- "Food and drink staff" is anyone who holds `fnb.serve` and not `fnb.manage`: Service, and floor managers. They hide an item and show it again, through `set_fnb_item_available`, and nothing else: no new item, no change of name, kind or description, no upload, no delete. The console shows them no way to, and the database refuses each (42501).
- "Admins" is who holds `fnb.manage`: super admins and admins, as the role matrix already has it. No role or permission changes. They add and change an item (`save_fnb_item`), upload the menu (`save_fnb_menu`) and delete an item (`delete_fnb_item`, new).
- A delete removes the item's row. An order keeps its own lines, with each item's name as it was, so past orders read as they did. The deletion is in the audit log.
- A deleted item's photo stays in storage; nothing shows it. Clearing such files is not built.
- Delete sits behind the row's "..." menu and is asked first, as Tables setup does (correction 3).
