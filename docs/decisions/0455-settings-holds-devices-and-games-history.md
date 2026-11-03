# 0455: Settings holds Devices and Games history

Date: 3 Nov 2026. Console v3 brief, Phase 1 route map and Phase 6: "Settings, Devices and Games history are tabs of `/settings`".

- **Parts by permission.** Pill tabs above the part's own screen: Settings (settings.manage or venue.configure), Devices (devices.manage), Games history (tables.manage). A staff member sees only the parts they have; one asked for that they do not have opens their first; none is a refusal. The frame must let staff with only devices.manage or tables.manage reach `/settings` (the shell's route map).
- **One `?tab=`.** It names a part or a place in one, so links stay short and old ones keep working: an area (`club`, `floor`, `notices`), a kind of device (`tvs`, `tablets`, or `devices` for the first), or `history` (`games-history` too). `/settings?tab=club` still opens the club's details. Redirects: `/devices` and `/tvs` to `?tab=tvs`, `/tablets` to `?tab=tablets`, `/games-history` to `?tab=history`.
- **The parts stay their features'.** The route composes them: `SettingsScreen` takes the Devices and Games history parts as slots, as a feature never imports another.
- **TVs before the form.** The prototype lists the paired TVs, then Pair a TV, the reverse of D-02's order. The form keeps its own heading, so staff a TV sends here still find it at once.
