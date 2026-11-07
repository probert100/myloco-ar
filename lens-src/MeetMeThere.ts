/**
 * MeetMeThere — the main controller of MyLoco AR.
 *
 * Reads the wearer's pose (WearerPose) and the friend's MyLoco share
 * (FriendFeed), smooths and classifies it (FriendTracker), and drives the
 * world visuals (BeaconView) and the few bits of UI (BeaconLabelUI, HudUI,
 * SessionUI). Preview stand-ins (PreviewControlsUI) are wired here too.
 */
import {BeaconLabelUI} from "./BeaconLabelUI"
import {BeaconView} from "./BeaconView"
import {FriendFeed} from "./FriendFeed"
import {Band, FriendTracker, TrackState} from "./FriendTracker"
import {dirFromWorldYaw, formatAge, formatDistance} from "./GeoMath"
import {HudUI} from "./HudUI"
import {PreviewControlsUI} from "./PreviewControlsUI"
import {SessionUI} from "./SessionUI"
import {WearerPose} from "./WearerPose"

@component
export class MeetMeThere extends BaseScriptComponent {
  @ui.label('<span style="color: #FF7A59;">MeetMeThere – MyLoco AR main controller</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("Wearer position/heading (preview camera or real GPS).")
  wearerPose: WearerPose

  @input
  @hint("The friend's MyLoco share (simulated or live).")
  feed: FriendFeed

  @input
  @hint("World visuals: pillar, marker, rings, arrow.")
  beacon: BeaconView

  @input
  @hint("Name/distance chip that floats with the beacon.")
  label: BeaconLabelUI

  @input
  @hint("One-line guidance card.")
  hud: HudUI

  @input
  @hint("Wearer controls (Mute, End).")
  session: SessionUI

  @input
  @allowUndefined
  @hint("Editor-only stand-in controls.")
  previewControls: PreviewControlsUI

  @input
  @allowUndefined
  @hint("Soft chime for band changes and share end.")
  chime: AudioComponent
  @ui.group_end

  @input
  @hint("Show metres instead of feet.")
  metricUnits: boolean = false

  private tracker = new FriendTracker()
  private muted = false
  private sessionEnded = false
  private endedShownAt = -1
  private lastBand: Band | null = null
  private lastState = ""

  onAwake(): void {
    if (!this.wearerPose || !this.feed || !this.beacon || !this.label || !this.hud || !this.session) {
      print("[MeetMeThere] ERROR: a required @input is not wired")
      return
    }
    this.createEvent("OnStartEvent").bind(() => this.onStart())
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private onStart(): void {
    this.feed.onFix.add((fix) => this.tracker.onFix(fix))
    this.feed.onStateChanged.add((s) => {
      if (s === "ended") {
        this.endedShownAt = getTime()
        this.playChime()
      }
    })
    this.session.onMuteChanged.add((m) => {
      this.muted = m
      print("[MeetMeThere] muted=" + m)
    })
    this.session.onEnd.add(() => this.endSession())
    if (this.previewControls) {
      this.previewControls.onSignalLost.add((lost) => this.feed.setSignalLost(lost))
      this.previewControls.onSkipCloser.add(() => this.feed.skipCloser(40))
      this.previewControls.onEndShare.add(() => this.feed.endShare())
      this.previewControls.onRestart.add(() => this.restart())
    }
    if (this.chime) {
      this.chime.playbackMode = Audio.PlaybackMode.LowLatency
    }
  }

  private restart(): void {
    this.sessionEnded = false
    this.endedShownAt = -1
    this.lastBand = null
    this.tracker.reset()
    this.feed.resetSimulation()
    this.session.expand()
    this.label.setVisible(true)
    print("[MeetMeThere] restart")
  }

  private endSession(): void {
    this.sessionEnded = true
    this.endedShownAt = getTime()
    print("[MeetMeThere] session ended by wearer")
  }

  private onUpdate(): void {
    const dt = getDeltaTime()
    const pose = this.wearerPose.getPose()
    const snap = this.feed.getSnapshot()
    const name = snap.name || "Your friend"
    const cam = pose.worldPos

    let track: TrackState | null = null
    if (pose.ready && snap.fix) {
      track = this.tracker.update(dt, Date.now(), pose.lat, pose.lng, pose.accuracyM)
    }
    const active = !this.sessionEnded && snap.state === "live" && track !== null && track.valid

    // World visuals
    const yaw = track ? track.bearingDeg - pose.northOffsetDeg : 0
    const dir = dirFromWorldYaw(yaw)
    this.beacon.render(
      {
        active,
        band: track ? track.band : "far",
        freshness: track ? track.freshness : "live",
        distanceM: track ? track.distanceM : 100,
        dirX: dir.x,
        dirZ: dir.z,
        groundY: pose.groundY,
        uncertaintyM: track ? track.combinedAccuracyM : 10,
        hereRadiusM: track ? track.hereRadiusM : 15,
      },
      dt
    )

    // Chip + HUD + session status
    if (this.sessionEnded) {
      this.label.setVisible(false)
      this.hud.show(getTime() - this.endedShownAt < 4 ? "Session ended" : null, "Your friend's link keeps working on their side until it expires.")
      this.session.setStatus("Session ended")
      this.logState("session-ended")
      return
    }
    if (!pose.ready) {
      this.label.setVisible(false)
      this.hud.show("Finding your position…", "Look around for a moment so the compass can settle.")
      this.logState("pose-wait")
      return
    }
    if (snap.state === "waiting" || !track) {
      this.label.setVisible(false)
      this.hud.show("Waiting for " + name + "'s location…", "They share from the MyLoco app. No SPECS needed on their side.")
      this.session.setStatus("Waiting for " + name)
      this.logState("waiting")
      return
    }
    if (snap.state === "ended") {
      this.label.setVisible(false)
      const reason = snap.endedReason === "expired" ? "Their share link expired." : "They tapped Stop sharing in MyLoco."
      this.hud.show(getTime() - this.endedShownAt < 6 ? name + " stopped sharing" : null, reason)
      this.session.setStatus(name + " stopped sharing")
      this.logState("ended")
      return
    }

    const dist = formatDistance(track.distanceM, this.metricUnits)
    let status: string
    if (track.freshness === "live") status = dist + " · live"
    else if (track.freshness === "stale") status = "last seen " + formatAge(track.ageS) + " ago · " + dist
    else status = "location is old (" + formatAge(track.ageS) + ")"
    this.session.setStatus(name + " · " + status)

    if (track.band === "here") {
      this.label.setVisible(false)
      const radius = formatDistance(track.hereRadiusM, this.metricUnits)
      this.hud.show(name + " is within ~" + radius + ". Look around.", track.freshness === "live" ? "GPS can't be more exact than this ring." : "Last seen " + formatAge(track.ageS) + " ago")
    } else {
      this.label.setVisible(true)
      this.label.setLines(name, status, track.freshness === "live")
      this.label.setPose(this.beacon.labelAnchor, this.beacon.labelScale, cam)
      this.hud.show(track.freshness === "old" ? name + "'s location is old" : null, "They may have moved. The beacon shows where they were.")
    }

    if (track.bandChanged && (track.band === "near" || track.band === "here")) this.playChime()
    if (this.lastBand !== track.band) {
      print("[MeetMeThere] band=" + track.band + " distance=" + track.distanceM.toFixed(1) + "m")
      this.lastBand = track.band
    }
    this.logState("live-" + track.band + "-" + track.freshness)
  }

  private playChime(): void {
    if (this.muted || !this.chime) return
    this.chime.play(1)
  }

  private logState(s: string): void {
    if (s === this.lastState) return
    this.lastState = s
    print("[MeetMeThere] state=" + s)
  }
}
