# 0424: A club notice is a card on Tonight that stays, edited in place, with line breaks and links

Date: 3 Nov 2026. The owner: notices "are not set up properly". Edit them, keep their formatting, no close on Home, and design how they sit with the offers and the tables. Their answers on 3 Nov: edit in place with times; line breaks and automatic links; Home while browsing only; a card above the offers.

- **On Tonight.**
  - **Placement:** while browsing, at most two `NoticeCard`s show, newest first, under the urgent banners and above Rate visit, the offers and the tables. A third waits until one ends.
  - **Behaviour:** there's no dismiss, and they load with the page.
  - **Not shown:** while the member waits, is called or is seated.
  - **What this replaces:** the dismissible notice banner of the redesign brief (2.2 and 3.4 A1, decision 0320).
- **Formatting (`NoticeText`).** A blank line starts a paragraph and a line break is kept. A plain host straight after `https://` becomes a link that reads left to right and opens in a new tab. Nothing is read as HTML.
- **Database rules.** Up to 500 characters (from 280), more than blank space, trimmed. Refused: `http://`; a user part, even behind extra slashes; any control or direction mark. A link must go where it reads.
- **Editing.**
  - `update_notice` changes a live or coming notice in place: its words, its end, and its start before it begins.
  - An ended notice is refused (P0002). Ending one still to come takes it down.
  - Every change is audited.
- **Not changed.** Only staff with `settings.manage` post. There is no approval, no tier targeting and no red notice.
- **Still to do (Part 2, after console v3).** The console editor, and `post` with a start and an end in `@rivr/db`.
