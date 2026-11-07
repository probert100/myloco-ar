# Design notes: MyLoco AR — Meet Me There

These notes record the reasoning behind `design-brief.md`. They cover the problem, the audience, why it belongs on glasses,
and how each point from the spec review was resolved. They also feed the pitch and the Devpost description.

## Problem
Finding one person in a crowd is the last 300 ft problem of every meetup: festivals, stadium gates, airport arrivals,
graduation fields. Map apps get you to the area. After that you're looking down at a blue dot, rotating the phone, looking
up, and guessing which of 40 people in a green jacket is your friend.

## Audience
Anyone meeting someone in a busy place. Only the seeker wears SPECS. The person being found uses the MyLoco phone app, which
is already live on the App Store and Google Play: tap **Share my location**, pick a duration, and send the link. The
recipient needs no app and no account, and the share expires on a timer.

## Why glasses (the three strengths)
- **Draws in the world:** the answer to "where?" is a light standing on the spot, in the direction you're already walking.
- **Leaves your body free:** eyes up and phone in your pocket while you weave through a crowd.
- **The phone test:** anything a phone shows just as well (a map, a list, chat, settings) was cut. What's left only works
  because it's in the world.

## "Doesn't Snap Map already do this?"
Snap Map shows Snapchat friends who use Snapchat, on a 2D map, on a phone. MyLoco AR differs in four ways:
1. **The friend needs nothing new.** There's no Snapchat account, no friendship graph, and no SPECS. Any MyLoco share link
   works.
2. **The share is temporary by design.** It expires on its own and the location data is deleted.
3. **It's in the world, not on a map.** Your eyes stay up.
4. **It's cross-platform.** Snap's Navigation Kit can position members of a Snap group. MyLoco AR brings in someone from
   *outside* that ecosystem.

## How the review's points were resolved
| Review point | Resolution in this build |
|---|---|
| Preview has no moving GPS and an inverted heading | **WearerPose seam.** Preview takes position and heading from the camera transform, and the device uses LocationService plus north-aligned heading. One flag (`mode`) switches them. |
| Outdoor Navigation template only projects 2D markers | No template. The bearing math (`GeoMath.ts`), the far-distance rendering trick (constant angular size at a capped render distance) and all meshes (`Meshes.ts`) are original. |
| The empty preview scene undersells the idea | `PreviewSet.ts` adds tents, a stage and 320 crowd silhouettes, labelled **PREVIEW SET** and disabled on device. |
| "Snap Map already does this" | Answered in the first 30 s of the video (see `submission.md`). |
| Show CLAD + MCP use | `build-log.md` lists every MCP tool call class and which CLAD skills drove which file. |
| Compounded GPS error | Errors are combined in quadrature. The ring radius is the combined accuracy. The Here band is max(15 m ≈ 50 ft, combined accuracy). |
| A 2 s feed makes the beacon jump | A critically damped spring with short dead reckoning (`FriendTracker.ts`). Hysteresis (15%) separately stops band flicker. |
| "Recenter" was undefined | Cut. On device, the north offset is continuously low-pass filtered against the compass instead. |
| The video plan contradicted itself | The video starts on the beacon. The simulated first fix arrives in under 0.5 s. |
| Audio default vs mute | Chime is **on** by default, and the button says **Mute**. |
| Voice "End session" | Cut from the build. **End** is a button. |
| Only claim what MyLoco does today | The MyLoco app is live in both stores (checked 2026-11-07). The demo uses the simulated feed and says so. Real-share mode uses MyLoco's actual `get_share` endpoint. |

## Consent and privacy
The friend opts in by creating a share, chooses how long it lasts, and can stop it at any time. The Lens only reads a share
it was given. It records nothing, identifies nobody, and sends nothing back.
