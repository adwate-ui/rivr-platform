# 0512: Every column filtered by its type, from its header, kept in the address

Date: 9 Nov 2026 · The owner approved the filters redesign ("Why is it not covering all the columns?"). Supersedes the 8 Nov Filters panel.

- **Every column** with a heading has a menu beside its name: sort either way, its filter, Clear. Sorting stays one press on the name; a phone opens the menus from a bar above the cards.
- **Kinds:** `text` (contains), `choice` (values with counts), `number` (from and to; Money in rupees), `duration` (hours, of seconds), `date` (presets or days, on the club's day). A column may say its kind or `false`. Otherwise `filterKindOf` reads its rows: figures shown as they sort, moments, few repeating values, else words.
- **Pills:** the filters in force show above the table, each removable, with Clear all (the search too) and "N of M". The header stays when nothing matches, and exports record every filter.
- **The address:** the console keeps each table's order, search and filters under `t.<table>`, through a row opened, Back, a reload and a link. A write replaces the entry: once typing pauses, a menu closes or the search is left. Screens' own links carry the views (`useNavigateKeepingViews`). Members' tier chips keep `tier` the same way.
- **Members docked:** the list keeps every column beside a record and scrolls sideways (`scrollsSideways`).
- **Not done:** a date picker or checkbox list beyond `Input type="date"` and ChoiceChips, neither of which is in ui.md.
