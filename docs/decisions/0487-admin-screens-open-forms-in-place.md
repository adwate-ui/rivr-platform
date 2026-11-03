# 0487: The admin screens open their forms in place

Date: 3 Nov 2026. Console v3 brief, Phase 6 (Staff, Tables, Settings), against `ConsoleAdmin.dc.html`.

- **A row opens in place.** `DataTable` takes `rowDetail`: what a row opened shows as a row of its own under it, across every column, counted in the table's rows for a screen reader. A dealer's PIN, a setting's new value and a stake's or table's own form open there; New stake and New table open above the list. Not in a list past 200 rows, whose rows are one height.
- **Tables stay on the page.** The prototype draws each table in a raised card with its heading inside. `DataTable`'s header is held on the page's colour as the rows scroll under it, and Members (the same component) sits on the page, so the admin tables do too: a section heading, then its button at the end of the line.
- **No line under a heading.** The prototype puts a sentence under each screen's title ("The stakes the club runs..."). The copy rules (`.claude/rules/copy.md`) allow none unless a field cannot be filled without it, and CLAUDE.md wins, so they are left out. Purge keeps its existing line on what a purge deletes.
- **Delete is asked twice in place.** `ConfirmButton` (now with `size` and the `subtle` look) gives Delete, then "Yes, delete Table 3" in red; a table in play is refused at once, not asked first.
- **Fields beside buttons are one height.** Where a field and its button share a line (a PIN, a tablet's name, a setting's day and reason), the field is `Input variant="subtle"` and the button `size="compact"`, both 36 px at a desk and 44 px below 1180 px, centred on the line; the hint or error goes under the line and is read with the field (`aria-describedby`).
- **Wide tables scroll on a phone.** The admin tables use `narrowLayout="scroll"`, the first column held, as the prototype's do at 390 px.
