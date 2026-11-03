# 0488: Settings holds Devices and Games history

Date: 3 Nov 2026. Console v3 brief, Phase 1 route map and Phase 6: "Settings, Devices and Games history are tabs of `/settings`".

- **The shell's tabs.** The shell's `ScreenTabs` holds them, as it holds Door's, Rewards' and Content's: `/settings?tab=settings|devices|games-history`, each tab shown to the staff whose role opens it (settings.manage or venue.configure, devices.manage, tables.manage). A tab's own parts go in `&part=`: an area of Settings (`club`, `floor`, `notices`) or a kind of device (`tvs`, `tablets`). Old addresses (`/devices`, `/tvs`, `/tablets`, `/games-history`) redirect there.
- **The admin screens are the tabs' panes.** Settings' areas, Devices' TVs and Tablets, and Games history are unchanged as screens; the admin work changes what is inside them (decisions 0487, 0489).
- **TVs before the form.** The prototype lists the paired TVs, then Pair a TV, the reverse of D-02's order. The form keeps its own heading, so staff a TV sends here still find it at once; Pair is the tab's one gold action, as is Add on Tablets.
- **A tablet's name and Add share a line.** Both 44 px with their ends lined up, the hint or error under the line and read with the field, so Add sits centred on the field.
