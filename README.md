# MyLoco AR — Meet Me There

A Lens for **SPECS** that helps you find one friend in a crowd. Your friend shares their location from the
[MyLoco](https://myloco.app) phone app. On SPECS, a coral light pillar stands over the crowd exactly where they are. It
turns into a person-height marker as you get close, then into a ring around you when you're within GPS range.

> Entry for Devpost's **Learn AR with SPECS** (Nov 2026): [Devpost project](https://devpost.com/software/myloco-ar-meet-me-there) ·
> [demo video](https://youtu.be/mGn3sGOS5Nk). Planning docs are in [`devpost/`](devpost/).
>
> **Demo video (2:15):** https://youtu.be/mGn3sGOS5Nk

**Evidence at a glance.** Every done criterion in the [design brief](devpost/design-brief.md) has a LEAF scenario, and all
7 scenarios pass in the Lens Studio preview: beacon at start, walking through the bands, the off-view arrow, signal lost
and restore, share ended, mute, and an IK reachability check on the controls. Tests, bugs found and the full CLAD/MCP
toolchain are in [`devpost/build-log.md`](devpost/build-log.md).

**How it differs from what exists.** Google Maps' Live View in Location Sharing shows a friend in AR on a phone held up
at arm's length, and Snap Map shows Snapchat friends on a map. MyLoco AR keeps your eyes up and hands free on SPECS, works
for a friend who has no Snap or Google account (just a self-expiring MyLoco link), and draws an honest uncertainty ring
instead of a falsely precise pin.

## What it does
- **Far (beyond 75 m / ~250 ft):** a tall pillar on the friend's bearing. It's drawn at most 40 m away and keeps its angular
  size, so it reads at 600 ft. A chip shows their name, distance and freshness ("Maya · 590 ft · live").
- **Near:** a person-height marker at their smoothed position, inside a ground ring whose radius is the **combined GPS
  uncertainty** of both phones.
- **Here (within max(50 ft, combined accuracy)):** the marker hides and a ring appears around you: "Maya is within ~50 ft.
  Look around."
- **Off-view arrow** when they're outside the ~32° view. A **chime** plays on band changes (on by default, with a Mute
  button).
- **Never freezes on old data:** after 20 s without an update the beacon goes hollow and counts "last seen N s ago". After
  5 min it says the location is old. Share ended or expired → fades out with a message.
- Wearer controls are just **Mute** and **End**. Everything a phone does better was cut.

## Preview vs. hardware
| Seam | Lens Studio preview | SPECS hardware |
|---|---|---|
| `WearerPose` | Position + heading from the preview camera (WASD = walking; world −Z = north; origin = Dorothea Dix Park, Raleigh) | `LocationService` (Navigation accuracy) + north-aligned heading, filtered on the circle |
| `FriendFeed` | Scripted friend walking a path with realistic GPS noise, one fix every 2 s | Polls MyLoco `get_share` for a real share token (set `anonKey` + `shareToken` in the Inspector) |
| `PreviewControlsUI` | Yellow panel: Signal lost / Restore, Skip closer, End share, Restart | Hidden |
| `PreviewSet` | Tents, stage and ~900 crowd silhouettes (labelled PREVIEW SET) | Hidden |

## Project layout
This folder is the Lens Studio project (open `MyLocoAR.esproj`).
```
Assets/Scripts/              Lens TypeScript (14 modules, table below)
Assets/Tests/                LEAF scenarios: one per done criterion + an IK reachability check + the video tour
Assets/Materials/            BeaconUnlit.mat (Unlit, alpha-blended; cloned per visual at runtime)
Assets/Audio/chime.wav       Band-change / share-ended chime (generated, original)
Packages/                    SpectaclesInteractionKit, SpectaclesUIKit, Leaf (v2.0.2), AI Preview Agent (dev tooling)
devpost/                     plan-lens design brief, design notes, build log, screenshots, submission kit, video
```

| Script | Role |
|---|---|
| `MeetMeThere.ts` | Main controller: pose + feed → tracker → visuals and UI |
| `WearerPose.ts` | Preview camera ↔ real GPS/compass seam |
| `FriendFeed.ts` | Simulated friend ↔ live MyLoco share seam |
| `FriendTracker.ts` | Alpha filter across noisy fixes, smoothing with dead reckoning, bands with hysteresis, freshness, combined accuracy |
| `GeoMath.ts` | ENU/bearing math, formatting |
| `BeaconView.ts` | Pillar, marker, rings, off-view arrow (procedural meshes) |
| `Meshes.ts` | MeshBuilder primitives |
| `BeaconLabelUI.ts`, `HudUI.ts`, `SessionUI.ts`, `PreviewControlsUI.ts` | SpectaclesUIKit UI modules |
| `UiKitHelpers.ts` | Shared UIKit panel / text / button helpers (CLAD `specs-build-ui` patterns) |
| `LazyFollow.ts` | Keeps panels reachable while walking (yaw-only, dead zone) |
| `PreviewSet.ts` | Preview-only festival set dressing |

## Run it in the preview
1. Open `MyLocoAR.esproj` in Lens Studio 5.24+ (no sign-in needed).
2. Preview panel: **SPECS 27** device, **Interactive** input, the **Plane** scene (open ground for walking).
3. WASD to walk, right-drag to look, click = pinch. Glance down for the wearer panel (Mute / End) and the yellow
   **PREVIEW CONTROLS** (Signal lost / Restore, Skip closer, End share, Restart).

## Tests (LEAF)
Open the LEAF panel in Lens Studio and run the scenarios in `Assets/Tests/` (registered by the `LeafIndex` object), or
ask a coding agent with CLAD to run them through the Lens Studio MCP. All 7 pass; results are in
[`devpost/build-log.md`](devpost/build-log.md).

| Scenario | Checks |
|---|---|
| `dc1-beacon-at-start` | Beacon + chip "Maya · 600 ft · live" at start, distance updates as she walks |
| `dc2-walk-closer-bands` | Walking / Skip closer: Far → Near (marker + uncertainty ring) → Here ("Maya is within ~X ft. Look around."), and the HUD stays in view after a turn |
| `dc3-off-view-arrow` | Turning away shows the edge arrow on her side; turning back hides it |
| `dc4-signal-lost-restore` | Signal lost → hollow + "last seen N s ago" counting; Restore → live |
| `dc5a-end-share` | End share → fade + "Maya stopped sharing", in view after a turn |
| `dc5b-mute-toggles-chime` | Mute swallows the chime, Unmute brings it back |
| `ik-reach-wearer-controls` | A simulated arm + head can reach every wearer control (0 LEAF diagnostics) |

`video-tour` is not a test of a done criterion: it is the submission video's shot list (camera moves and pinches,
timed to the voice-over), and it still fails if a state it shows doesn't happen.

## Video
[`devpost/video/`](devpost/video/): the 2:15 submission video (the mp4 is not in git; it's on [YouTube](https://youtu.be/mGn3sGOS5Nk)), its thumbnail,
and the scripted pipeline that made it from a Lens Studio preview recording of `video-tour`, ElevenLabs voice and music,
and ffmpeg. See [`devpost/build-log.md`](devpost/build-log.md) → "The submission video".

## Known limits
- The device path (GPS + compass via `LocationService`) is written against the SPECS Location API but can only be
  proven on real SPECS outdoors. The preview uses the camera as the wearer.
- The optional live MyLoco share mode needs an anon key (left empty in the repo). On device, internet + location in one
  Lens requires Snap's Extended Permissions.
- The AI Preview Agent package and the `AiPreviewAgent Handler` object are developer tooling for agent-driven preview
  checks; they don't affect the Lens.

## Built with
Lens Studio 5.24.1 · Spectacles Interaction Kit · Spectacles UI Kit · CLAD (ls-clad) skills · Lens Studio MCP ·
Devpost Learn `plan-lens` skill. See [`devpost/build-log.md`](devpost/build-log.md).

## Privacy
The friend opts in, chooses the duration and can stop at any time. The Lens only reads the share it was given. It records
nothing, identifies nobody and sends nothing back.
