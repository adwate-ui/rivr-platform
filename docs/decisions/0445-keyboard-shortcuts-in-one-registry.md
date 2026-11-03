# 0445: Keyboard shortcuts go through one registry

Date: 3 Nov 2026. Console v3 brief, phase 1: "/ and Ctrl/Cmd K for search, Esc to close, and on the Live floor A, D and S. Ignore shortcuts while typing in a field. Show them in tooltips."

- **Where.** @rivr/ui, not the console's frame, because the Live floor's feature binds its keys and a feature never imports another: `ShortcutProvider` (the frame holds it), `useShortcut({ key, label, onPress, isEnabled })` and `useShortcutList()`.
- **When a key does nothing.** While the focus is in a field (input, textarea, select, contenteditable) or inside a dialog (a sheet, the palette), with Ctrl, Cmd or Alt held, on a held-down repeat, or when the binding is disabled. The latest binding for a key wins; a key nobody bound is left to the page.
- **Tooltips.** `useShortcut` gives back `{ key, hint }`; `Button`'s new `shortcut` prop puts the hint in its `title` ("Seat a player (S)") and the key in `aria-keyshortcuts`.
- **List.** The staff member's menu lists `/` and Ctrl K (Search), the keys the screen offers, sorted by key, and Esc (Close). `/` and Ctrl K stay with `CommandPalette`, which listened for them already; Escape stays with each dialog and menu.
