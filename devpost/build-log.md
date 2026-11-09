# Build log: MyLoco AR — Meet Me There

How the Lens went from the approved `plan-lens` brief to a working SPECS Lens. The build used CLAD skills and the Lens
Studio MCP, driven by Claude Code (Opus 5.5) on Robert's Mac. Lens Studio 5.24.1, SPECS 27 preview, Nov 7–8, 2026.

## Result

All five done criteria from `devpost/design-brief.md` have a LEAF scenario, and **all pass in the Lens Studio preview**
(final regression run after the last code change). Criterion 5 is split into two scenarios, and there is one extra
reachability test.

| # | Done criterion | LEAF scenario | Result | What the run printed |
|---|---|---|---|---|
| 1 | Coral beacon ~600 ft away, chip "Maya · 600 ft · live", updates as she walks | `dc1-beacon-at-start` | ✅ pass | chip `Maya · 600 ft · live`, then `600 → 590 → 580 ft` over 10 s |
| 2 | Walking / Skip closer lowers distance; <75 m → marker + uncertainty ring; Here → ring + "Maya is within ~X ft. Look around." | `dc2-walk-closer-bands` | ✅ pass | walked 15 m: `600 → 530 ft`; `band=near` at 63 m; `band=here` at 12.6 m; HUD `Maya is within ~50 ft. Look around.`, and after a 20° turn the HUD is 5.7° from the view centre (in view) |
| 3 | Turning away shows the edge arrow; turning back hides it | `dc3-off-view-arrow` | ✅ pass | facing east: arrow weight 1.00, 11 cm left of centre; facing north: 0.00 |
| 4 | Signal lost → dim/hollow + "last seen N s ago" counting; Restore → live | `dc4-signal-lost-restore` | ✅ pass | `last seen 20 s ago` → `23 s ago` 3 s later; core hidden; back to `live` after Restore |
| 5a | End share → beacon fades + "Maya stopped sharing" | `dc5a-end-share` | ✅ pass | HUD `Maya stopped sharing`, chime played, beacon weight → 0; HUD 5.5° from centre after a 20° turn |
| 5b | Mute toggles the chime | `dc5b-mute-toggles-chime` | ✅ pass | `chime (muted)` on the Far→Near change; after Unmute the next cue plays |
| — | Every control is within reach (brief: comfort check) | `ik-reach-wearer-controls` | ✅ pass | LEAF IK arm + head reached Mute, Skip closer and the pill: **0 diagnostics** |

No done criterion is untested. What the tests **can't** prove is listed under "Feel unproven" below.

How criteria 2 and 3 are tested: a LEAF scenario can't move the preview camera directly (Device Tracking rewrites it
every frame). It re-parents the camera under a runtime rig and moves or turns the rig, which is what WASD and mouse-look
do to the tracked pose. A probe scenario confirmed this before the tests were written, and was then deleted. The same
moves were also checked by hand with the `MovePreviewCamera` MCP tool (screenshots 03 and 04).


## Toolchain actually used

**CLAD skills (ls-clad plugin, Lens Studio's agent toolkit).** I loaded each one and followed its procedure in this session:

| Skill | Used for |
|---|---|
| `lens-studio-router` (`mode: preflight_only`) | Project / MCP / sign-in gate. The full-build path (spawning `specs-experience-builder`) was not used because the scripts already existed. The build followed the same pipeline in this session instead. |
| `lens-studio-field-notes` | Hard rules (MCP only, no raw HTTP, no shell `tsc`), the see-and-fix loop, and the definition of done |
| `specs-project-init` | Checked target = Spectacles, Camera Perspective + DeviceTracking World, SIK + UIKit, SIK prefab, Preview = SPECS 27 / Interactive / Plane |
| `editor-api` | Every `ExecuteEditorCode` call (verified against `Support/editor.d.ts`) |
| `materials` | `BeaconUnlit.mat` from the Unlit preset; found the preset ships with blending **Disabled** |
| `scene-construction` (+ `virtual-scene.md`) | Two-phase VirtualScene bootstrap: structure, recompile, then inputs wired by component UUID |
| `specs-build-ui` (+ gotchas, helpers) | UIKit panel structure, init-order gotchas, `addItems` vs auto-discovery, 4 cm targets, text roles |
| `preview-inspection` | `QueryRuntimeSceneTool` / `CaptureRuntimeViewTool` checks; installed AI Preview Agent |
| `specs-leaf-install-packages`, `specs-leaf-write-scenarios`, `specs-leaf-run-in-preview` | LEAF install, scenario authoring, LeafIndex on the scene, serial runs in the preview |

The API audit also checked the device-only `GeoLocation` and `InternetModule` code against CLAD's `specs-location` and
`specs-internet` skills (that path isn't exercised in the preview).

**Lens Studio MCP tools:** `ListAllPanels`, `ExecuteEditorCode`, `VirtualScene`, `asset-graphql`, `scene-graphql`,
`RecompileTypeScriptTool`, `RunAndCollectLogsTool`, `CapturePanelScreenshotTool`, `CaptureRuntimeViewTool`,
`QueryRuntimeSceneTool`, `PreviewInteractTool`, `MovePreviewCamera`, `PreviewPanelTool`, `ListInstalledPackagesTool`,
`SearchLensStudioAssetLibrary`, `InstallLensStudioPackage`, `open_leaf_panel`, `list_leaf_scenarios`,
`run_leaf_scenario`.

**Other:** Claude Code's `claude plugin` CLI (to install `ls-clad`), `npx skills add challengepost/learn-specs`, a
general-purpose subagent for a read-only API audit of the cloud-written code, and desktop computer use for two GUI-only
steps: creating the project (Home → SPECS → Base Template → Save As) and a Lens Studio plugin permission dialog.

## What happened, in order

1. **Setup.** The session started outside the project folder, so the Lens Studio MCP wasn't connected. I created the
   project through the Lens Studio UI, moved the handoff files in, installed CLAD and the skill pack, and ran `git init`.
   The session then moved into `MyLocoAR/` to pick up the project's `.mcp.json`.
2. **API audit, before any compile.** A subagent checked every API in the cloud-written code against `StudioLib.d.ts`
   and the UIKit/SIK sources. It confirmed most calls and flagged the issues in the table below. Lens Studio's own
   compile then reported one error.
3. **Gate.** The router showed Lens Studio wasn't signed in. SPECS developer sign-ups aren't open, and the Asset Library
   works signed out, so the build continued signed out. Nothing used needs an account. (The Devpost FAQ's workaround,
   downgrading to 5.23.2, wasn't needed.)
4. **Bootstrap.** Imported `chime.wav` through the Editor API and created the material with `asset-graphql`. The
   VirtualScene Phase A (36 writes) and Phase B (20 input wirings) applies both landed with 0 errors.
5. **See-and-fix loop**: recompile → run + logs → capture → judge → fix, repeated. First capture: the beacon and chip
   worked, but the panels were off-screen and the preview set swamped the view. Fixes are below.
6. **Package trap.** The Asset Library's newest LEAF and AI Preview Agent (v4.0.0) target Lens Studio 5.25 and the
   renamed `InteractionKit`/`UIKit` packages. They broke TypeScript compilation in this 5.24.1 project, and their install
   left a modal "Loading LEAF Plugin" permission dialog open, which froze every scene edit. Robert approved "Trust and
   Load" (Snap's own LEAF plugin). The v4 packages were removed and replaced with **LEAF v2.0.2** and **AI Preview Agent
   v2.0.1**, which match SIK/UIKit v2.
7. **LEAF.** Six scenarios were written and run; one failed for a real reason (below), the Lens was fixed, and all six
   passed. A seventh, IK reachability, failed twice: the session panel folded away under the reaching hand. The Lens was
   fixed and it passed. The full suite was re-run after the last change.
8. **Submission video (Nov 8).** Reviewing the recorded footage frame by frame found two more Lens bugs that the
   LEAF assertions couldn't see, because they checked text, not pixels (table below). Both were fixed, DC2 and DC5a gained a
   "HUD is actually in view" assertion (shown failing on the old setting first), and the full suite was re-run: all 7
   pass. How the video was made is described under "The submission video".

## Bugs found and how

| Bug (in the cloud-written code unless noted) | Found by | Fix |
|---|---|---|
| `MeshIndexType.UInt32` doesn't exist (only `UInt16`) | Lens Studio compile | 16-bit indices plus a vertex-count warning (largest mesh: 44,100 vertices) |
| Camera view direction used `Transform.forward` (+Z). A Lens Studio camera looks down −Z, which is `.back`, as in SIK's own camera provider. Panels would have spawned behind the wearer, and the heading and off-view arrow would have been flipped. | Code reading against SIK source; API audit; confirmed by the LEAF probe (`back = (0,0,-1)`) | `.back` in WearerPose, LazyFollow, BeaconView |
| Unlit preset ships with `blendMode: Disabled`, so every alpha fade (stale beacon, cross-fades, share-end fade) would have rendered opaque | API audit flagged it; `asset-graphql` property read confirmed | Normal blending on the material and on every runtime clone |
| HUD and session pill disabled themselves in `onAwake`, before UIKit components initialise on `OnStart` | CLAD `specs-build-ui` gotcha G3 | Hide after the first layout pass (`deferredVisibility`) |
| Chip distance bounced 600 → 590 → 600 ft while Maya walked. The "smoothing" followed each noisy 2 s fix, and ±7 m GPS noise swamped 8 m of walking. | **LEAF `dc1` failed** | Alpha filter across fixes, weighted by accuracy, with her reported velocity in the prediction. Jumps over 3σ still pass through, so Skip closer stays instant. |
| Session panel folds away after 8 s even while a hand is reaching for it | **LEAF IK test** failed twice with `ray failed to converge on Button_Mute`: the panel had collapsed under the reaching hand | Hovering a button resets the idle timer; the test reaches for the session panel first |
| Wearer buttons 2–3 cm tall, below the brief's "at least 4 cm" | Checking the brief while investigating the IK failure | Full-scale panels, text sized for 75 cm, buttons 4.1–4.4 cm |
| Lower panels sat at ±18°, outside the SPECS 27 per-eye view (about ±17°) | Preview capture | Panels at ±10.5 cm, 75 cm ahead, 27 cm below eye level (glance down) |
| Preview set (this session's own design issue): a stage straight ahead hid the chip, and 320 people over 200 m didn't read as a crowd | Preview captures | ~900 people along the walk, stage off-axis, set drawn first with no depth writes (on SPECS nothing virtual is hidden by real people) |
| Near-band chip overlapped the marker's head; stale beacon too faint to find | Preview captures | Anchor above the head; stale brightness 0.45 → 0.6 |
| Far-band chip sat on the pillar's axis, so the pillar's near face drew over the chip text ("M▮a", "590▮live"). Screenshot 01 from the first build shows it; `dc1` passed because it checks the chip's text, not its pixels. | Frame-by-frame review of the video footage | Chip stands just in front of the pillar, toward the wearer (`BeaconView`); screenshot 01 retaken |
| HUD trailed the head with a 25° yaw dead zone, but a SPECS eye sees about ±17°: after a turn, "Maya is within ~50 ft. Look around." and "Maya stopped sharing" could sit outside the view indefinitely | Video review (the messages never appeared in the shots); then reproduced in LEAF: `dc2` with a 20° turn measured the HUD **20.0°** off-centre and failed | HUD `LazyFollow`: dead zone 6°, follow rate 4 (scene change). `dc2`/`dc5a` now assert the HUD is within 10° of the view centre after a 20° turn: 5.7° / 5.5°. The wrist-level panels keep 25° (you glance down to find them). |

Other environment issues found along the way: Lens Studio's Agents-Docs plugin deletes `.agents/`, which the skill
pack's `.claude/skills/plan-lens` symlinked to, so the skill was restored as a real copy. `/usr/local/bin/git` on this
Mac is an Intel binary, so `/usr/bin/git` was used.

## Screenshots (Lens Studio preview, SPECS 27, one eye)

| File | State |
|---|---|
| `screenshots/01-start-beacon-600ft.png` | Start: pillar over the crowd, chip "Maya · 590 ft · live" in front of it (retaken after the chip fix) |
| `screenshots/02-near-marker-uncertainty-ring.png` | Near band: person marker, chip above her, uncertainty ring on the ground |
| `screenshots/03-here-ring-look-around.png` | Here band: ring around the wearer, "Maya is within ~50 ft. Look around." |
| `screenshots/04-off-view-arrow.png` | Turned 90° away: chevron at the left edge pointing back to her |
| `screenshots/05-signal-lost-stale.png` | Signal lost: hollow grey beacon, "last seen 29 s ago · 590 ft" |
| `screenshots/06-share-ended.png` | End share: beacon gone, "Maya stopped sharing" |
| `screenshots/07-wearer-controls-glance-down.png` | Glancing down: Mute / End panel and the yellow PREVIEW CONTROLS |

## The submission video

`devpost/video/MyLocoAR-Meet-Me-There.mp4` (2:15, 1080p30; not in git, upload it to YouTube) and `thumbnail.png`.
Every Lens shot is a real Lens Studio preview recording (SPECS 27, one eye); nothing in the Lens view is drawn in post.

- **Camera moves and pinches: a LEAF scenario.** `Assets/Tests/VideoTourScenario.ts` (`video-tour`) is the shot list
  as code: it re-parents the camera under a rig, looks, walks and glances at the panels, pinches the buttons with LEAF's
  interactor, and checks each state it shows (near, stale, here, ended) so a bad take fails. Action times come from the
  voice-over's word timings, so a pinch lands on the word that describes it. It passed on every recorded take.
- **Recording.** Lens Studio's own preview recorder (Record Video). Two traps: starting a scenario resets the preview,
  which discards a running recording (so the tour holds 80 s, then presses Restart), and the recorder stamps every frame
  at 30 fps whatever the render rate (a take made while the screen was locked rendered ~9 fps and played 2.8× fast). The
  tour therefore draws a 16-bit timecode at the top edge of the view; the edit reads it from every frame, resamples to
  real time and crops the strip off. Six takes: 1 was too slow, 2 was discarded by a screenshot mid-recording, 3 had a
  band flicker caused by the tour (two Skip closer pinches left Maya ~20 m away, where GPS noise dips into Here; the tour
  now pinches once and walks in), 4 showed the HUD bug, 5 glanced down at fixed angles and missed the trailing panels
  (the tour now looks at each panel's real position), 6 is the final.
- **Voice-over:** ElevenLabs `eleven_v4` text-to-speech (premade voice "Chris"), with word timestamps; every line was
  transcribed back with ElevenLabs speech-to-text (`scribe_v1`) to check pronunciation of MyLoco, SPECS, CLAD and LEAF.
- **Music:** ElevenLabs **video-to-music** scored the finished picture edit (instrumental, no SFX); speech-to-text
  found no words in it. It is ducked 13.5 LU under the voice. Final mix −14.8 LUFS, true peak −1.1 dBFS. (A prompt-based
  `music_v2_5` track was also generated and not used.)
- **Chime:** the Lens's own `chime.wav`, placed at the three times the log shows it playing (the preview recorder
  doesn't capture Lens audio).
- **Edit:** Python + ffmpeg, scripts in `devpost/video/pipeline/`. Zoom boxes ("In the lens, zoomed") follow the white
  UI text in the full-resolution footage and magnify it; the yellow tags mark preview stand-ins; green tags name the
  LEAF scenario behind each claim.

## Logic proven vs feel unproven

- **Logic proven (LEAF + captures):** bands with hysteresis, the stale/old/ended states, chip text, the off-view arrow
  geometry, chime and mute, and button reachability with a simulated arm.
- **Feel unproven (needs real SPECS outdoors):** real GPS and compass accuracy in a crowd; the device path of
  `WearerPose` (`LocationService` + north-aligned heading, which the preview can't exercise); how the coral beacon reads
  in daylight on the additive display; real hand tracking; comfort over a long walk.
- **Not exercised:** the optional live MyLoco share mode (`FriendFeed` source 1), because the anon key stays empty in
  the repo. On device, internet + location in one Lens needs Snap's Extended Permissions (CLAD `specs-internet`); the
  demo uses the simulated feed.
