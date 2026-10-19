# 0052 Three type sizes for the TV, from the prototype's TV

Date: 19 Oct 2026. Task #65.

The design inventory's type scale (12 to 96 px) came from the phone and console screens of the prototype. The prototype's TV, a 1920 by 1080 stage read from across the room, uses larger sizes that the scale never had.

Three of them join the tokens:
- **48 px:** a player's name on the waitlist board.
- **88 px:** a board's title and tonight's high hand, in the display face.
- **280 px:** the jackpot figure, the largest thing on any screen.

They are used only on the TV, through `@rivr/ui`'s `tvTitle` heading, `tvJackpot` figure and the TV boards. The inventory records them as the TV scale, and the tokens test checks both scales.

The prototype's other TV sizes are mapped to the nearest existing size:
- 22 and 26 to 24;
- 30 to 28;
- 38 and 40 to 36;
- 300 to 280.

Rejected: fitting the boards to 96 px, which leaves the jackpot figure a third of the prototype's and unreadable from the back of the room.
