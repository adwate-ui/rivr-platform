# 0440: The menu from a file

Date: 3 Nov 2026. Issue #799 (the owner, 3 Nov, #654): group the console's menu by type, and let staff upload it from a file instead of adding items one by one, with a preview and errors per row before saving.

- **Grouped.** The console's menu sets each item under its kind, in the app's words and order: Food, Soft drinks, Bar. An item reads as its name alone, and the kinds to choose for a new item use the same words.
- **The file.** A CSV whose first line names the columns: `name` and `type` are needed (`item` and `kind`, as Glaza's files say, also read), `on offer` (yes or no) is not: left blank, or with no such column, an item the menu has stays as it is and a new one is on offer. Types read as the console or the app name them: food; soft drink or soft drinks; bar or alcohol. Up to 300 items.
- **No price.** The menu keeps no price (#123, decision 0284), so a price column, or any other, is left out: not saved and not shown.
- **Preview.** Every line shows before anything is saved: the item as it will be saved, or what is wrong with it (no name, a type the menu has not, on offer not yes, no or blank, a name listed above in any case). Save shows only once every line reads.
- **Saving.** `save_fnb_menu` saves the whole file in one transaction, all or none, for staff who run or serve F&B, as `save_fnb_item` allows. A name the menu has, in any case, keeps its spelling and place, and takes the file's kind and, when the file says, whether it is on offer; an item already as the file says is left untouched. A new name goes after the last item, in the file's order. Nothing is removed: an item not in the file stays as it was, and Off the menu takes one out of the app.
- **Where.** Menu from a CSV is a section of Food and drink after the menu, for everyone who keeps the menu.
- **Orders** stay on Food and drink, as before.
- **Accepted.** A file can move an item between kinds, alcohol included, as the one-at-a-time editor can for the same staff; the preview shows each line's kind.
