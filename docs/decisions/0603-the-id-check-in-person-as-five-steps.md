# 0603. The ID check in person as five steps

Redesign RD-21 (#964), owner 15 Nov. Decided while building.

- **The bar starts once a member is chosen.** The search and "Due tonight" are how the desk finds the member; the five steps (Member, Face, PAN card, Aadhaar front, Details) are that member's check, under `Stepper look="progress"`.
- **Member is a step of its own**: the member's name, the end of their mobile number and their app selfie if they took one, then Start the check, or Choose another member, which drops what was taken and typed for this one.
- **"Use photo" moves on to the first photo still missing, else to Details.** A first pass goes Face, PAN card, Aadhaar front, Details; a photo taken again from Details comes back to Details, as it came back to the form before.
- **Back goes one step back and keeps everything.** A photo step whose photo is kept shows the photo, with Next and "Take the photo again", not its camera; a photo step has no Next until its photo is kept, so Details is reached only with all three.
- **A check where only photos were sent back** (decision 0573) opens on the first of them: the bar on that photo's step, its camera ready, and why it came back above it. Each photo is saved as it is kept, as before; the bar then moves to the next one owed. Leaving the camera, or a photo that was not saved, shows what is still owed.
- **The checks, the words and the rules are the ones before**: the cameras (auto-capture, zoom, the Aadhaar's bars to confirm, the hand-off to a phone where there is no back camera), consent asked at the desk, and the gate in the database. New words are the five step names, "Start the check", "Choose another member" and "Next"; "Take their photo" goes, since Start opens the camera.
