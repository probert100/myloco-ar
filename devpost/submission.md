# Devpost submission kit: MyLoco AR — Meet Me There

## Short description (paste into Devpost)

**MyLoco AR — Meet Me There** finds one friend in a crowd. It puts a coral light pillar over the friend's real location, in
your view, on SPECS.

**What it does.** Your friend taps *Share my location* in the MyLoco phone app (live on iOS and Android) and texts you the
link. On SPECS, a pillar of light stands over the crowd in their direction, with their name, distance and freshness ("Maya ·
590 ft · live"). As you walk, the pillar becomes a person-height marker inside a ring that shows how precise GPS really is.
Once you're inside that uncertainty, a ring around you says "Maya is within ~45 ft. Look around." If their phone stops
reporting, the beacon goes hollow and counts up "last seen 40 s ago". It never pretends old data is live. When they stop
sharing, it fades out and says so.

**Who it's for.** Anyone meeting someone in a busy place: festivals, stadium gates, arrivals halls, graduation fields. Only
the seeker needs glasses. The friend needs no SPECS, no Snapchat and no account, and the share expires on its own.

**How it's built.** The Lens was planned with the Devpost Learn `plan-lens` skill (`devpost/design-brief.md`) and built by a
coding agent through Snap's CLAD plugin skills and the Lens Studio MCP: VirtualScene scene bootstrap, TypeScript compile and
runtime-log loops, preview captures, and LEAF tests. Two seams make it demo-able in the preview and real on hardware:
**WearerPose** (preview camera ↔ SPECS GPS + compass) and **FriendFeed** (scripted friend ↔ live MyLoco `get_share` API).
The beacon geometry, the smoothing and hysteresis, the combined-accuracy rings and the off-view arrow are original code.
There is no navigation template.

**What I learned.** In AR the design work is mostly about honesty and restraint. Two GPS errors add up, so the UI shows a
circle, not a pin. A 2-second feed needs smoothing. Stale data has to look stale. Everything a phone could show was cut. In
the preview, the hardest part was faking the world correctly: Lens Studio's preview can't move GPS and turns the compass the
wrong way, so the camera stands in for the wearer.

**Preview stand-ins (labelled in the video).** A simulated friend walks a scripted path with realistic GPS noise. A yellow
**PREVIEW CONTROLS** panel triggers signal loss, share end and "skip closer". The tents and crowd are a **PREVIEW SET** that
doesn't ship on device.

## Video script (target 2:30, screen recording of the Lens Studio preview)

| Time | Picture | Narration (say it in your own words) |
|---|---|---|
| 0:00 | **Beacon already on screen**, chip "Maya · 600 ft · live" | "This is my friend Maya, 600 feet away in a festival crowd. She shared her location from the MyLoco app, and on SPECS it's a light standing right where she is." |
| 0:12 | Slow look around the crowd, beacon stays put | "Only I need glasses. Maya just has the MyLoco app, with no Snapchat and no account, and her link expires on its own. That's the difference from Snap Map: it works with anyone, and it's in the world, not on a phone map." |
| 0:30 | Turn away; off-view arrow appears; turn back | "If she's out of view, a small arrow points the way, and nothing else clutters the view." |
| 0:42 | Walk forward (WASD), distance drops; pinch **Skip closer** once (yellow panel) | "Distance and freshness update every couple of seconds. This yellow panel is a preview stand-in, because the Lens Studio preview can't move GPS. On SPECS this comes from the real Location API." |
| 1:00 | Pillar → person marker with ring | "Closer in, the pillar becomes a person-sized marker. The ring is honest about GPS: both our phones' errors add up, so I look inside the circle instead of trusting a pin." |
| 1:20 | Walk into the Here band; ring around you; HUD line | "Once I'm inside that uncertainty, it stops pretending to be precise: 'Maya is within 45 feet. Look around.' Eyes up, phone in my pocket." |
| 1:35 | Pinch **Signal lost**; beacon goes hollow; "last seen 12 s… 20 s ago" counting | "If her phone stops reporting, it never freezes on old data. It goes hollow and tells me how old the location is." |
| 1:50 | Pinch **Restore**, then **End share** → "Maya stopped sharing" | "When she stops sharing, it fades and says so." |
| 2:00 | Pinch **Mute** / **End** on the session panel | "Two controls, Mute and End. I cut everything a phone does better." |
| 2:10 | Cut to Lens Studio + agent terminal / build-log | "I planned it with the plan-lens skill and built it with CLAD through the Lens Studio MCP: scene bootstrap, compile and log loops, preview captures and LEAF tests for each done criterion." |
| 2:25 | Back to beacon | "MyLoco AR. Meet me there." |

Recording tips: Preview panel in **Interactive** mode, SPECS device; start recording, then press **Restart** on the preview
controls so the first frame is the beacon. Keep the mouse on a pinch target before clicking. No music with copyrighted material.

## Submission checklist
- [ ] Repo public on GitHub with the Lens Studio project folder (`MyLocoAR/`) and `devpost/`
- [ ] YouTube video public, under 3:00
- [ ] Description pasted (above), with the repo + video links
- [ ] Disclosure: no pre-existing code in the Lens. It calls MyLoco's existing public `get_share` API (my own product)
      in optional real-share mode. The `tools/mcp-relay.mjs` helper is build tooling, not part of the Lens.
- [ ] Submitted before **Nov 9, 2026, 5:00 PM EST**
