# Devpost submission kit: MyLoco AR — Meet Me There

## Short description (paste into Devpost)

**MyLoco AR — Meet Me There** solves the last 600 feet of a meet-up. Your friend shares a self-expiring MyLoco link (no
app or account needed on your side). On SPECS, a coral light pillar stands over the crowd where they are, and you keep
your eyes up and your hands free. It never lies: the ring grows with GPS error, and old data looks old.

**What it does.** Your friend taps *Share my location* in the MyLoco phone app (live on iOS and Android) and texts you the
link. On SPECS, a pillar of light stands over the crowd in their direction, with their name, distance and freshness ("Maya ·
590 ft · live"). As you walk, the pillar becomes a person-height marker inside a ring that shows how precise GPS really is.
Once you're inside that uncertainty, a ring around you says "Maya is within ~45 ft. Look around." If their phone stops
reporting, the beacon goes hollow and counts up "last seen 40 s ago". It never pretends old data is live. When they stop
sharing, it fades out and says so.

**Who it's for.** Anyone meeting someone in a busy place: festivals, stadium gates, arrivals halls, graduation fields. Only
the seeker needs glasses. The friend needs no SPECS, no Snapchat and no account, and the share expires on its own.

**How it differs.** Google Maps' Live View in Location Sharing shows a friend in AR on a phone you hold up in the
crowd. Snap Map shows Snapchat friends on a 2D map. MyLoco AR is eyes-up and hands-free on SPECS, works for a friend with
no Snap or Google account, and shows its uncertainty instead of a falsely precise pin.

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

## Video (done: `devpost/video/MyLocoAR-Meet-Me-There.mp4`, 2:15)

Made by the agent, not screen-captured by hand: the camera moves and pinches are the `video-tour` LEAF scenario, the
footage is Lens Studio's preview recorder (SPECS 27, one eye), the voice-over and the music are ElevenLabs, and the edit is
scripted (`devpost/video/pipeline/`). Details are in `devpost/build-log.md` under "The submission video". Upload it with
`devpost/video/thumbnail.png` as the thumbnail.

| Time | Picture | Narration (ElevenLabs voice) |
|---|---|---|
| 0:00 | Beacon over the crowd; zoom: "Maya · 580 → 550 ft · live" | "This is my friend Maya. She's about six hundred feet away, somewhere in a festival crowd. She shared her location from the MyLoco app, and on SPECS, she's a pillar of light, standing right where she is." |
| 0:14 | Look around the crowd; the beacon stays put | "Only I need glasses. Maya just has the MyLoco phone app. No Snapchat, no account, and her link expires on its own. That's the difference from Snap Map: it works with anyone, and the answer is out in the world, not on a map." |
| 0:30 | Turn 95° away: edge arrow; turn back | "If I turn away, a small arrow at the edge of my view points back to her. Nothing else clutters the view." |
| 0:38 | Walk 10 m (zoom: 440 → 370 ft); glance down; pinch **Skip closer** | "As I walk, the distance and freshness update every couple of seconds. On SPECS, my position comes from the glasses' own location and compass. The Lens Studio preview can't move GPS, so this yellow panel is a stand-in. I'll skip closer." |
| 0:56 | Pillar → person marker inside the uncertainty ring (chime) | "Closer in, the pillar becomes a person-sized marker, inside a ring. The ring is honest about GPS: both our phones' errors add up, so I look inside the circle instead of trusting a pin." |
| 1:10 | Pinch **Signal lost**; "20 seconds later": hollow marker, zoom "last seen 21 → 24 s ago"; pinch **Restore** | "If her phone stops reporting, it never pretends old data is live. The marker goes hollow, and the label counts how old her last location is. When the signal comes back, it's live again." |
| 1:23 | Walk into Here: ring around me, HUD zoom "Maya is within ~50 ft. Look around." | "Once I'm inside that uncertainty, it stops pretending to be precise. It just tells me Maya is close, and to look around. Eyes up, phone in my pocket." |
| 1:35 | Glance at the session panel; pinch **Mute** (zoom: Mute → Unmute) | "On my side, there are only two controls: Mute, and End. I cut everything a phone does better." |
| 1:43 | Pinch **End share**: beacon fades, HUD "Maya stopped sharing" (chime) | "And when Maya stops sharing, the beacon fades out, and tells me so." |
| 1:49 | How it was built: plan-lens brief, CLAD skills + MCP tools, see-and-fix loop, 7/7 LEAF, the tour scenario | "I planned this with the plan-lens skill, and built it with Snap's CLAD skills through the Lens Studio MCP: scene bootstrap, compile and log loops, preview captures, and a LEAF test for every done criterion. All seven pass. Even the camera moves in this video are a scripted LEAF scenario." |
| 2:09 | Beacon again; end card | "MyLoco AR. Meet me there." |

Suggested YouTube title: **MyLoco AR — Meet Me There (SPECS Lens, Learn AR with SPECS)**. Suggested description: the
short description above, plus "Voice-over and music generated with ElevenLabs. Footage: Lens Studio 5.24 preview,
SPECS 27. Repo: https://github.com/probert100/myloco-ar". (Used as-is, with chapters.)

## Submission checklist
- [x] Repo public on GitHub: https://github.com/probert100/myloco-ar (this `MyLocoAR/` folder is the repo root)
- [x] Video made: `devpost/video/MyLocoAR-Meet-Me-There.mp4`, 2:15 (under 3:00), thumbnail `devpost/video/thumbnail.png`
- [x] YouTube video public: https://youtu.be/mGn3sGOS5Nk (channel Robert Misior)
- [x] Devpost project filled in (story, tags, gallery, repo + video links, additional info): https://devpost.com/software/myloco-ar-meet-me-there
- [x] Disclosure: pre-existing code is limited to Snap packages (Spectacles Interaction Kit, Spectacles UI Kit, LEAF,
      AI Preview Agent). All Lens code is new, written during the submission period by AI coding agents: an initial script
      draft came from a cloud Claude session without Lens Studio access, and every script was then integrated, fixed,
      built and tested by Claude Code with CLAD through the Lens Studio MCP (7/7 LEAF tests; see `devpost/build-log.md`).
      MyLoco itself is my pre-existing product; the Lens contains none of its code. The optional real-share
      mode calls MyLoco's existing public `get_share` API (my own product). The video's voice-over and music are
      AI-generated (ElevenLabs); the footage is the Lens running in the Lens Studio preview.
- [x] Submitted on Nov 8, 2026, before the **Nov 9, 2026, 5:00 PM EST** deadline (editable until then)
