# MyLoco AR — Meet Me There

A Lens for **SPECS** that helps you find one friend in a crowd. Your friend shares their location from the
[MyLoco](https://myloco.app) phone app. On SPECS, a coral light pillar stands over the crowd exactly where they are. It
turns into a person-height marker as you get close, then into a ring around you when you're within GPS range.

> Entry for Devpost's **Learn AR with SPECS** (Nov 2026). Planning docs are in [`devpost/`](devpost/).

## What it does
- **Far (beyond 75 m / ~250 ft):** a tall pillar on the friend's bearing. It's drawn at most 40 m away and keeps its angular
  size, so it reads at 600 ft. A chip shows their name, distance and freshness ("Maya · 590 ft · live").
- **Near:** a person-height marker at their smoothed position, inside a ground ring whose radius is the **combined GPS
  uncertainty** of both phones.
- **Here (within max(50 ft, combined accuracy)):** the marker hides and a ring appears around you: "Maya is within ~45 ft.
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
| `PreviewSet` | Tents, stage and 320 crowd silhouettes (labelled PREVIEW SET) | Hidden |

## Project layout
```
MyLocoAR/                    Lens Studio project (open MyLocoAR.esproj)
  Assets/Scripts/            Lens TypeScript (sources mirrored in lens-src/)
devpost/                     plan-lens design brief, design notes, build log, submission kit
lens-src/                    canonical copies of the Lens scripts + chime.wav
tools/mcp-relay.mjs          build tooling: file relay to the Lens Studio MCP (not part of the Lens)
```

| Script | Role |
|---|---|
| `MeetMeThere.ts` | Main controller: pose + feed → tracker → visuals and UI |
| `WearerPose.ts` | Preview camera ↔ real GPS/compass seam |
| `FriendFeed.ts` | Simulated friend ↔ live MyLoco share seam |
| `FriendTracker.ts` | Smoothing (critically damped spring + dead reckoning), bands with hysteresis, freshness, combined accuracy |
| `GeoMath.ts` | ENU/bearing math, formatting |
| `BeaconView.ts` | Pillar, marker, rings, off-view arrow (procedural meshes) |
| `Meshes.ts` | MeshBuilder primitives |
| `BeaconLabelUI.ts`, `HudUI.ts`, `SessionUI.ts`, `PreviewControlsUI.ts` | SpectaclesUIKit UI modules |
| `LazyFollow.ts` | Keeps panels reachable while walking (yaw-only, dead zone) |
| `PreviewSet.ts` | Preview-only festival set dressing |

## Run it in the preview
1. Open `MyLocoAR/MyLocoAR.esproj` in Lens Studio 5.24+.
2. In the Preview panel choose the SPECS device and **Interactive** input.
3. WASD to walk, right-drag to look, click = pinch. Use the yellow **PREVIEW CONTROLS** to simulate signal loss, skip
   closer, or end the share.

## Built with
Lens Studio 5.24.1 · Spectacles Interaction Kit · Spectacles UI Kit · CLAD (ls-clad) skills · Lens Studio MCP ·
Devpost Learn `plan-lens` skill. See [`devpost/build-log.md`](devpost/build-log.md).

## Privacy
The friend opts in, chooses the duration and can stop at any time. The Lens only reads the share it was given. It records
nothing, identifies nobody and sends nothing back.
