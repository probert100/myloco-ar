# Build log: MyLoco AR — Meet Me There

How the Lens went from the approved `plan-lens` brief to a working SPECS Lens. The build used CLAD skills and the Lens
Studio MCP, driven by Claude Code (Opus 5.5) on Robert's Mac. Lens Studio 5.24.1, SPECS 27 preview, Nov 7, 2026.

## Result

All five done criteria from `devpost/design-brief.md` have a LEAF scenario, and **all pass in the Lens Studio preview**
(final regression run after the last code change). Criterion 5 is split into two scenarios, and there is one extra
reachability test.

| # | Done criterion | LEAF scenario | Result | What the run printed |
|---|---|---|---|---|
| 1 | Coral beacon ~600 ft away, chip "Maya · 600 ft · live", updates as she walks | `dc1-beacon-at-start` | ✅ pass | chip `Maya · 600 ft · live`, then `600 → 590 → 580 ft` over 10 s |
| 2 | Walking / Skip closer lowers distance; <75 m → marker + uncertainty ring; Here → ring + "Maya is within ~X ft. Look around." | `dc2-walk-closer-bands` | ✅ pass | walked 15 m: `600 → 530 ft`; `band=near` at 63 m; `band=here` at 12.6 m; HUD `Maya is within ~50 ft. Look around.` |
| 3 | Turning away shows the edge arrow; turning back hides it | `dc3-off-view-arrow` | ✅ pass | facing east: arrow weight 1.00, 11 cm left of centre; facing north: 0.00 |
| 4 | Signal lost → dim/hollow + "last seen N s ago" counting; Restore → live | `dc4-signal-lost-restore` | ✅ pass | `last seen 20 s ago` → `23 s ago` 3 s later; core hidden; back to `live` after Restore |
| 5a | End share → beacon fades + "Maya stopped sharing" | `dc5a-end-share` | ✅ pass | HUD `Maya stopped sharing`, chime played, beacon weight → 0 |
| 5b | Mute toggles the chime | `dc5b-mute-toggles-chime` | ✅ pass | `chime (muted)` on the Far→Near change; after Unmute the next cue plays |
| — | Every control is within reach (brief: comfort check) | `ik-reach-wearer-controls` | ✅ pass | LEAF IK arm + head reached Mute, Skip closer and the pill: **0 diagnostics** |

No done criterion is untested. What the tests **can't** prove is listed under "Feel unproven" below.

How criteria 2 and 3 are tested: a LEAF scenario can't move the preview camera directly (Device Tracking rewrites it
every frame). It re-parents the camera under a runtime rig and moves or turns the rig, which is what WASD and mouse-look
do to the tracked pose. A probe scenario confirmed this before the tests were written, and was then deleted. The same
moves were also checked by hand with the `MovePreviewCamera` MCP tool (screenshots 03 and 04).

## Who wrote what (honest version)

| Part | Author |
|---|---|
| Idea, MyLoco product, the spec and review answers behind the brief | Robert |
| `devpost/design-brief.md` | `plan-lens` skill (Devpost Learn pack), from Robert's answers |
| First draft of all 14 Lens scripts (`lens-src/`, ~1,900 lines, see commit `1535833`) | A cloud Claude session, written without Lens Studio access and never compiled |
| Project creation, scene, material, audio import, every fix below, 9 LEAF test files (~460 lines), preview set rework | This session (Claude Code + CLAD + Lens Studio MCP) |

12 of the 14 cloud-written scripts were changed in this session (about 330 changed lines). `FriendFeed.ts` and
`GeoMath.ts` are unchanged. `git diff 1535833 HEAD` shows every change.

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

Other environment issues found along the way: Lens Studio's Agents-Docs plugin deletes `.agents/`, which the skill
pack's `.claude/skills/plan-lens` symlinked to, so the skill was restored as a real copy. `/usr/local/bin/git` on this
Mac is an Intel binary, so `/usr/bin/git` was used.

## Screenshots (Lens Studio preview, SPECS 27, one eye)

| File | State |
|---|---|
| `screenshots/01-start-beacon-600ft.png` | Start: pillar over the crowd, chip "Maya · 600 ft · live" |
| `screenshots/02-near-marker-uncertainty-ring.png` | Near band: person marker, chip above her, uncertainty ring on the ground |
| `screenshots/03-here-ring-look-around.png` | Here band: ring around the wearer, "Maya is within ~50 ft. Look around." |
| `screenshots/04-off-view-arrow.png` | Turned 90° away: chevron at the left edge pointing back to her |
| `screenshots/05-signal-lost-stale.png` | Signal lost: hollow grey beacon, "last seen 29 s ago · 590 ft" |
| `screenshots/06-share-ended.png` | End share: beacon gone, "Maya stopped sharing" |
| `screenshots/07-wearer-controls-glance-down.png` | Glancing down: Mute / End panel and the yellow PREVIEW CONTROLS |

## Logic proven vs feel unproven

- **Logic proven (LEAF + captures):** bands with hysteresis, the stale/old/ended states, chip text, the off-view arrow
  geometry, chime and mute, and button reachability with a simulated arm.
- **Feel unproven (needs real SPECS outdoors):** real GPS and compass accuracy in a crowd; the device path of
  `WearerPose` (`LocationService` + north-aligned heading, which the preview can't exercise); how the coral beacon reads
  in daylight on the additive display; real hand tracking; comfort over a long walk.
- **Not exercised:** the optional live MyLoco share mode (`FriendFeed` source 1), because the anon key stays empty in
  the repo. On device, internet + location in one Lens needs Snap's Extended Permissions (CLAD `specs-internet`); the
  demo uses the simulated feed.
