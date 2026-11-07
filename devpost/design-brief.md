---
status: approved
---

# Design brief: MyLoco AR — Meet Me There

<!-- Planned with the Devpost Learn plan-lens skill (challengepost/learn-specs). The interview answers came from Robert's
MyLoco AR spec and the written review of that spec (see devpost/design-notes.md). The review's fixes are applied here. Values
Robert didn't pick explicitly are marked (default). -->

## The one spatial moment
You're at a packed outdoor festival looking for a friend. They tapped **Share my location** in the MyLoco phone app and texted
you the link. You put on SPECS and a tall coral light pillar stands over the crowd, exactly where they are, with "Maya · 590 ft ·
live" floating at its base. You walk toward it with your eyes up and your phone in your pocket. The pillar turns into a
person-height marker as you get close, and then into a ring on the ground around you: "Maya is within ~40 ft. Look around."

## Why it belongs on glasses
- Uses: **draws in the world** (the beacon sits on the friend's real position, over the crowd) and **leaves your body free**
  (eyes up, hands free, walking through a crowd, no phone held at arm's length).
- Why it's better than the phone version: on a phone you look down at a map, rotate it, look up, guess which tent is which, and
  look down again. On glasses the answer sits in the direction you're already walking. **The phone test:** anything a phone
  could show just as well (a map, a list, settings) is cut from the Lens.
- **Only the seeker needs glasses.** The friend shares from the MyLoco phone app they already have, or from any MyLoco share
  link. They need no SPECS, no Snapchat, and no account, and the share expires on its own.

## Product or overlay
- Type: overlay. It responds to a real person's live location.
- What the real version would sense: the friend's position from their MyLoco share (polled from MyLoco's `get_share` API),
  plus the wearer's own GPS and compass heading from the SPECS Location API.
- Stand-in for the preview: Lens Studio's preview can't move GPS or give a correct compass heading (it pins location to a fixed
  spot and inverts heading). So the Lens has two seams:
  - **WearerPose:** in preview, the wearer's position and heading come from the preview camera's transform (WASD walking =
    walking). On SPECS hardware, they come from `LocationService` and the north-aligned heading. One flag switches them and
    nothing else changes.
  - **FriendFeed:** in preview, a **simulated friend** walks a scripted path across the festival grounds, sending a GPS fix
    every 2 s with realistic noise and accuracy. Optionally, a **real MyLoco share token** can be pasted into the Inspector to
    poll the live `get_share` API instead.
  - A small panel labelled **PREVIEW CONTROLS** fakes the moments the preview can't produce: "Signal lost" (friend's phone
    stops updating), "End share", and "Skip closer" (moves the simulated friend 40 m toward you, to keep the video short).

## Where things live
- Where the user is looking during the main task: straight ahead and slightly up, toward the horizon over the crowd, while
  walking.
- **Beacon pillar (Far band, beyond 75 m (default)):** a tall, soft-edged coral light column standing on the ground at the
  friend's bearing. It is rendered at most 40 m away (default) and scaled so it always subtends about 10° tall (default), so it
  reads over a crowd at any distance without clipping the far plane.
- **Name chip:** at the base of the beacon, readable at distance, about 1.6 m below eye level (default). It shows name, distance
  (ft/mi, or m/km), and freshness ("live" or "last seen 40 s ago"). Billboarded to face the wearer.
- **Person marker (Near band, Here threshold to 75 m):** a person-height (1.8 m) coral capsule with a halo, placed at the
  friend's smoothed true position. It has a floor ring whose radius is the **combined GPS uncertainty** of both people, so you
  look for them inside the ring, not at the exact pin.
- **Here ring (Here band):** when the distance is under max(15 m / 50 ft, combined accuracy) (default), the marker hides. A ring
  appears on the ground around the wearer with that radius, plus one line of text: "Maya is within ~40 ft. Look around."
- **Off-view arrow:** when the friend's direction is outside the ~32° view, a small coral chevron sits at the edge of the view
  (about 70 cm away) pointing the way. It disappears once the beacon is in view.
- **Session panel (wearer controls):** a small UI Kit panel at roughly arm's length, 30 cm below eye level, slightly left. It has
  two big buttons: **Mute/Unmute** and **End**. It can be dismissed.
- **Preview-only set dressing:** simple festival tents and crowd silhouettes made from primitives, so the video shows scale. They
  are labelled "PREVIEW SET" and disabled on device.

## Hands and input
- **Mute/Unmute:** pinch the big button on the session panel. Audio cues are **ON by default (default)**, and this button mutes
  them.
- **End:** pinch the End button. It closes the session and shows "Session ended".
- Preview controls (Signal lost / Restore, End share, Skip closer) are UI Kit buttons, pinched with the mouse.
- Targets are big (at least 4 cm at arm's length) and highlight when aimed at.
- Voice: out of scope for this build. Every action is a button.

## When things show
- **Waiting:** shows "Waiting for Maya's location…" until the first fix. With the simulated feed the first fix arrives in under
  1 s, so the very first frame of the video already shows the beacon.
- **Beacon / marker / here ring:** exactly one at a time, chosen by distance band. **Hysteresis** of 15% (default) on every band
  boundary, so the display doesn't flicker when someone stands on the line.
- **Position smoothing:** the friend's position is smoothed between 2 s fixes (critically damped follow with
  speed/heading dead reckoning), so the beacon glides instead of jumping. Hysteresis handles band flicker. Smoothing handles
  position jitter.
- **Live vs stale (never freeze on old data):** a fix older than 20 s (default) turns the beacon hollow and dim, and the chip
  counts up "last seen 35 s ago" every second. The beacon stays where they were last seen and never pretends to be live. After
  5 min (default) it reads "Location is old" and the beacon turns into a faint marker.
- **Ended:** when the share is stopped or expires, the beacon fades out over 2 s and a card says "Maya stopped sharing". Then it
  gets out of the way.
- **Session panel:** visible at start. It collapses to a small pill after 8 s of no interaction (default), and pinching the pill
  re-opens it.
- If something needs attention out of view: the off-view arrow, plus a soft chime on band changes (Far→Near, Near→Here) and when
  the share ends.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. At start, a coral beacon stands in the friend's direction about 590 ft away. Its chip reads "Maya · 590 ft · live" and
   updates as she walks.
2. Walking toward the beacon with WASD lowers the distance. Below 75 m (about 250 ft) the beacon turns into a person-height
   marker with an uncertainty ring on the ground. Below the Here threshold, a ring appears around the wearer with "Maya is
   within ~X ft. Look around."
3. Turning away until the beacon is out of view shows the edge arrow pointing toward it. Turning back hides the arrow.
4. Pressing **Signal lost** dims the beacon to its stale style, and "last seen N s ago" counts up every second. Pressing
   **Restore** returns it to live.
5. Pressing **End share** fades the beacon and shows "Maya stopped sharing". Pressing **Mute** toggles the chime.

## Out of scope
- Finding several friends at once (MyLoco groups). The feed interface allows it later.
- Voice commands, maps, chat, and turn-by-turn routing (the phone test cuts them).
- Snapchat login, Snap Map, Connected Lenses. The friend never needs SPECS or Snapchat.
- Sending the wearer's own location back to the friend.

## Risks and open questions
- **Feel unproven:** real GPS + compass accuracy in a crowd, heading calibration (about 20 s after an OS update), and how the
  beacon reads in bright daylight on an additive display. Only real SPECS outdoors can answer these.
- Both people's GPS errors add up (often 30–60 ft combined in a crowd). The design shows this with the uncertainty ring and the
  accuracy-driven Here threshold. It doesn't pretend to be precise.
- The real-share mode depends on the MyLoco `get_share` endpoint and a public anon key pasted into the Inspector. The demo video
  uses the simulated feed and says so.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.
- Consent: MyLoco sharing is opt-in by the friend, time-limited, and expires on its own. The Lens only reads a share the friend
  chose to send.
- Architecture seams (keep these as separate scripts): `WearerPose` (Preview / Device), `FriendFeed` (Simulated / MyLocoShare),
  `GeoMath` (ENU conversion, bearing, combined accuracy), `BandController` (hysteresis), `BeaconView`, `OffViewArrow`,
  `SessionUI` (UI Kit), `PreviewControlsUI` (UI Kit), `PreviewSet`.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
