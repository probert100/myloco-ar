@AGENTS.md

> **Status (Nov 8, 2026): submitted.** The Lens runs in the preview and all 7 LEAF scenarios pass (`devpost/build-log.md`).
> Repo: https://github.com/probert100/myloco-ar · Video: https://youtu.be/mGn3sGOS5Nk · Devpost:
> https://devpost.com/software/myloco-ar-meet-me-there (editable until Nov 9, 2026, 5:00 PM EST). The cloud session's
> original draft is in commit `1535833`.

# HANDOFF — MyLoco AR "Meet Me There" (Learn AR with SPECS)

You are Claude Code running **on Robert's Mac** with the **CLAD plugin (`ls-clad`)** and the **Lens Studio MCP**. This file
hands over work started by a cloud Claude session that couldn't reach Lens Studio's localhost MCP. Everything that didn't
need Lens Studio is done. Your job is to **create the project, build the scene, compile, verify in the preview, and write
LEAF tests**, using CLAD skills and MCP tools natively.

**Deadline: Mon Nov 9, 2026, 5:00 PM EST** (Devpost hard cutoff). Robert still has to record a <3 min YouTube video
afterwards, so aim to finish the build early.

## 0. Contest rules that matter
- Must be a **new** Lens for SPECS that **runs in the Lens Studio preview** (no glasses needed).
- Must be **planned with the Devpost Learn skill pack** (`plan-lens` → `devpost/design-brief.md`, done) and **built with CLAD +
  Lens Studio + Lens Studio MCP**. Judges score how well all three are used. Use the CLAD skills/agents for real and
  log what you did in `devpost/build-log.md`.
- Submit: public repo (Lens Studio project + `devpost/` folder), public YouTube video <3 min, short description
  (draft in `devpost/submission.md`).
- Judging is 4 equal criteria: Design, Technical Implementation (incl. CLAD/MCP use), Innovation, Presentation.
- Pages: https://learn-specs.devpost.com/ · /rules · /resources

## 1. What already exists (in this folder)
| Path | What |
|---|---|
| `devpost/design-brief.md` | **Approved** plan-lens brief: the spec. Read it first. Done criteria are in it. |
| `devpost/design-notes.md` | Pitch reasoning, "why not Snap Map", how each review point was fixed |
| `devpost/submission.md` | Devpost description draft, 2:30 video script, submission checklist |
| `lens-src/*.ts` | ~1,600 lines of Lens TypeScript, **written but never compiled** (no MCP was available). Expect compile errors. |
| `lens-src/Audio/chime.wav` | Two-tone chime (generated, original) |
| `README.md` | Repo README (update the paths once the project exists) |
| `tools/mcp-relay.*` | Build tooling from the cloud session; **not needed now**, don't ship it in the Lens |

The pure logic (`GeoMath.ts`, `FriendTracker.ts`) was unit-simulated in Node: bands switch correctly
(far → near ≈ 64 m, near → here ≈ 13 m) with no flicker. Everything else is unverified against the real APIs.

## 2. Step 0: project setup (do this first)
1. Lens Studio 5.24.1 is installed. If no SPECS project is open: Home → **SPECS** → **Base Template** → File → Save As →
   folder `~/Dropbox/osobiste_projekty/myloco-ar`, name **`MyLocoAR`** → creates `myloco-ar/MyLocoAR/MyLocoAR.esproj`.
   (Robert may do this for you before starting you.)
2. Claude Code must run **inside the folder that has the `.esproj` and `.mcp.json`**, i.e. `myloco-ar/MyLocoAR/`.
   That folder becomes the **git repo root**. Move the handoff material in:
   `mv ../devpost ../lens-src ../README.md ../CLAUDE.md .` (keep `../tools` out of the repo).
3. Verify `/mcp` shows `lens-studio` connected and `/plugin` lists `ls-clad`. If not:
   `/plugin marketplace add https://github.com/lens-studio-devs/ls-extensions.git`, `/plugin install ls-clad@ls-extensions`.
4. Skill pack (the contest requires it in the repo flow): `npx skills add challengepost/learn-specs --all -y`.
   The brief is **already approved**, so don't re-run the plan-lens interview. Keep `devpost/design-brief.md` as is.
5. Run `/lens-studio-router` → `specs-project-init`: target = Spectacles, Camera Perspective + DeviceTracking **World**,
   SIK + **SpectaclesUIKit** packages installed, Preview = stereo/Interactive.
6. `git init`, add a `.gitignore` (Lens Studio cache, `.DS_Store`, `.virtual-scene.json`), and make the first commit.

## 3. Build plan (follow CLAD: router → field-notes → scene-construction → see-and-fix loop)
Copy `lens-src/*.ts` → `Assets/Scripts/` and `lens-src/Audio/chime.wav` → import as an audio asset (through a Lens Studio
tool, so it gets a `.meta`). Recompile with `RecompileTypeScriptTool` and fix errors.

**APIs I wrote from docs/memory. Verify each against `Support/StudioLib.d.ts` and fix:**
- `global.deviceInfoSystem.isEditor()` (WearerPose, PreviewControlsUI, PreviewSet)
- `GeoLocation.createLocationService`, `GeoLocationAccuracy.Navigation`, `onNorthAlignedOrientationUpdate`,
  `GeoLocation.getNorthAlignedHeading`, `getCurrentPosition(pos, err)` (WearerPose; from CLAD `specs-location`)
- `require("LensStudio:RawLocationModule")` at module top, and `require("LensStudio:InternetModule")` (FriendFeed)
- `MeshBuilder` layout `{name, components, normalized}`, `MeshTopology.Triangles`, `MeshIndexType.UInt16/UInt32`,
  `appendVerticesInterleaved`, `appendIndices`, `updateMesh`, `getMesh` (Meshes.ts)
- `material.clone()`, `mainPass.twoSided`, `mainPass.depthWrite/depthTest`, and **`mainPass.baseColor` on the Unlit preset**
  (BeaconView, PreviewSet). If Unlit has no `baseColor`, switch the preset or param name.
- `@widget(new ComboBoxWidget([...]))` on `number` inputs (WearerPose.mode, FriendFeed.source)
- UIKit: `BackPlate.style = "dark"`, `Button.size` before init, `Button.onTriggerUp`, `FlexLayout.onLayoutComplete`,
  Text `weight` cast. Check against the installed `SpectaclesUIKit.lspkg`. `UiKitHelpers.ts` follows CLAD
  `specs-build-ui` patterns, but `addItems()` registration may be needed (see that skill's gotchas).
- `Event` default import from `SpectaclesInteractionKit.lspkg/Utils/Event`
- `Audio.PlaybackMode.LowLatency` on AudioComponent

**Scene graph to bootstrap (one VirtualScene apply):**
```
Camera Object            (existing; Perspective + DeviceTracking World)
MyLocoAR                 root
├── Controller           MeetMeThere (inputs wired below) + AudioComponent(chime.wav)
├── WearerPose           WearerPose { camera: Camera Object }
├── FriendFeed           FriendFeed { wearerPose: WearerPose(component) }
├── BeaconView           BeaconView { camera, baseMaterial: Materials/BeaconUnlit.mat }
├── BeaconLabel          BeaconLabelUI
├── Hud                  HudUI + LazyFollow { camera, offset (0,-18,-110) }
├── Session              SessionUI + LazyFollow { camera, offset (-24,-30,-75) }
├── PreviewControls      PreviewControlsUI + LazyFollow { camera, offset (26,-30,-75) }
└── PreviewSet           PreviewSet { baseMaterial: Materials/BeaconUnlit.mat, groundY: -160 }
```
MeetMeThere inputs: wearerPose, feed, beacon, label, hud, session, previewControls (**component** UUIDs, not
SceneObjects; see scene-construction gotchas), chime (AudioComponent). Create `Materials/BeaconUnlit.mat` from the
Unlit preset (alpha blend, two-sided OK).

**Known design-level risks to check in the preview:**
- Preview camera start height: PreviewSet assumes ground ≈ camera y − 160 cm. Adjust `groundY` / `eyeHeightCm` to the real preview.
- The Interactive preview room may box the camera in. The demo needs open space for ~40 m of walking (or use **Skip
  closer**). If the room blocks it, try a preview source without a room, or rely on Skip closer + Restart for the video.
- The camera far plane must reach ≥ 45 m (pillar render distance is 40 m). Raise `camera.far` if the pillar clips.
- Text sizes at 110 cm-calibrated UIKit roles. The beacon chip is scaled by `distance/110`. Sanity-check readability.
- The off-view arrow is camera-relative at 70 cm. Confirm it's inside the narrow SPECS FOV in stereo preview.

**See-and-fix loop after every meaningful change:** RecompileTypeScriptTool → RunAndCollectLogsTool (look for
`[MeetMeThere] state=` / `band=` prints) → CaptureRuntimeViewTool at 2+ timestamps → judge the pixels → fix.

## 4. Done criteria (from the brief): write a LEAF scenario for each (`specs-leaf-write-scenarios`)
1. At start, a coral beacon stands ~600 ft away with chip "Maya · 600 ft · live", updating as she walks.
2. Walking toward it (or Skip closer) lowers the distance. Below 75 m → person marker + uncertainty ring. Below the Here
   threshold → ring around the wearer + "Maya is within ~X ft. Look around."
3. Turning away shows the edge arrow, and turning back hides it.
4. **Signal lost** → beacon dims/hollow + "last seen N s ago" counting. **Restore** → live.
5. **End share** → beacon fades + "Maya stopped sharing". **Mute** toggles the chime.
Report which pass and which have no test.

## 5. Finish
- `devpost/build-log.md`: list which CLAD skills/agents and MCP tools were used for what, what the agent generated vs.
  what was hand-written (lens-src came from the cloud session; note it honestly), LEAF results, and screenshots.
- Update `README.md` paths. Save the project (`SaveProject`). Commit.
- Robert does the rest: create the public GitHub repo, push, record the video per `devpost/submission.md`, and submit.

## Constraints
- Don't record, identify or follow people. The friend's share is opt-in and expiring (MyLoco's model).
- Don't commit secrets. The MyLoco anon key stays empty in the repo (the real-share mode is optional; the demo uses the simulated feed).
- Don't claim anything the build doesn't show.
