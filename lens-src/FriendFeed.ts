/**
 * FriendFeed — the friend's side of the session: their MyLoco share.
 *
 * Two sources behind one interface (the "FriendFeed seam"):
 *   - Simulated (preview demo): a scripted friend walks across the festival
 *     grounds and reports a noisy GPS fix every 2 s, like the MyLoco phone app.
 *   - MyLoco share: polls the live MyLoco `get_share` API for a real share
 *     token (the same call the myloco.app/s/{token} web page makes).
 *
 * The friend never needs SPECS, Snapchat, or an account. Their share is opt-in
 * and expires on its own.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {GeoFix, enuLength, gaussian, makeRng, offsetLatLng} from "./GeoMath"
import {WearerPose} from "./WearerPose"

export type FeedState = "waiting" | "live" | "ended" | "error"

export interface FriendSnapshot {
  state: FeedState
  name: string
  /** Latest fix we received (null before the first one). */
  fix: GeoFix | null
  /** True while the sender's phone is not reporting (simulated "signal lost"). */
  endedReason: string | null
  message: string | null
}

interface Waypoint {
  east: number
  north: number
  pauseS: number
}

@component
export class FriendFeed extends BaseScriptComponent {
  @ui.label('<span style="color: #FF7A59;">FriendFeed – simulated friend or a live MyLoco share</span>')
  @ui.separator
  @input
  @hint("Simulated = scripted walk for the preview demo. MyLoco share = poll a real share token.")
  @widget(new ComboBoxWidget([new ComboBoxItem("Simulated friend", 0), new ComboBoxItem("MyLoco share", 1)]))
  source: number = 0

  @input
  @hint("Friend's display name for the simulated feed.")
  friendName: string = "Maya"

  @input
  @hint("Wearer pose, so the simulated walk is laid out around the preview origin.")
  wearerPose: WearerPose

  @ui.group_start("Simulation")
  @input
  @hint("Seconds between simulated fixes (the MyLoco app sends about every 2 s).")
  fixIntervalS: number = 2.0

  @input
  @hint("Simulated walking speed of the friend (m/s).")
  walkSpeedMps: number = 1.3

  @input
  @hint("Typical friend GPS accuracy in a crowd (metres, 1-sigma).")
  friendAccuracyM: number = 10
  @ui.group_end

  @ui.group_start("MyLoco share")
  @input
  @hint("MyLoco Supabase project URL.")
  supabaseUrl: string = "https://ukvonsrxashffvvcocce.supabase.co"

  @input
  @hint("MyLoco public (anon) API key. Leave empty to stay on the simulated feed.")
  anonKey: string = ""

  @input
  @hint("Share token from a myloco.app/s/{token} link.")
  shareToken: string = ""

  @input
  @hint("Seconds between polls of get_share.")
  pollIntervalS: number = 2.0
  @ui.group_end

  private snapshot: FriendSnapshot = {state: "waiting", name: "", fix: null, endedReason: null, message: null}
  private _onFix = new Event<GeoFix>()
  private _onStateChanged = new Event<FeedState>()
  get onFix(): PublicApi<GeoFix> {
    return this._onFix.publicApi()
  }
  get onStateChanged(): PublicApi<FeedState> {
    return this._onStateChanged.publicApi()
  }

  // Simulation state
  private rng = makeRng(7)
  private path: Waypoint[] = []
  private segIndex = 0
  private segPos = {east: 0, north: 0}
  private pauseLeft = 0
  private fixTimer = 0
  private signalLost = false
  private simEnded = false
  private simHeading = 0
  private simSpeed = 0
  private startedAt = 0

  // Network state
  private internet: InternetModule
  private pollEvent: DelayedCallbackEvent

  onAwake(): void {
    this.snapshot.name = this.friendName
    const useShare = this.source === 1 && this.anonKey.length > 0 && this.shareToken.length > 0
    if (useShare) {
      this.internet = require("LensStudio:InternetModule")
      this.pollEvent = this.createEvent("DelayedCallbackEvent")
      this.pollEvent.bind(() => this.pollShare())
      this.pollEvent.reset(0)
      print("[FriendFeed] polling MyLoco share")
    } else {
      if (this.source === 1) print("[FriendFeed] MyLoco share selected but key/token empty: using simulated friend")
      this.resetSimulation()
      this.createEvent("UpdateEvent").bind(() => this.stepSimulation(getDeltaTime()))
    }
  }

  getSnapshot(): FriendSnapshot {
    return this.snapshot
  }

  get isSimulated(): boolean {
    return this.internet === undefined
  }

  // ── Preview controls (stand-ins for things the preview can't produce) ──
  /** Friend's phone stops reporting (tunnel, dead battery, app backgrounded). */
  setSignalLost(lost: boolean): void {
    this.signalLost = lost
    print("[FriendFeed] signalLost=" + lost)
  }
  get isSignalLost(): boolean {
    return this.signalLost
  }

  /** Friend taps "Stop sharing" in the MyLoco app. */
  endShare(): void {
    if (this.snapshot.state === "ended") return
    this.simEnded = true
    this.setState("ended", "stopped")
  }

  /** Jump the simulated friend ~metres further along their walk (keeps the demo video short). */
  skipCloser(metres: number = 40): void {
    let remaining = metres
    while (remaining > 0 && this.segIndex < this.path.length - 1) {
      const target = this.path[this.segIndex + 1]
      const dx = target.east - this.segPos.east
      const dy = target.north - this.segPos.north
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d <= remaining) {
        this.segPos = {east: target.east, north: target.north}
        this.segIndex++
        remaining -= d
      } else {
        this.segPos.east += (dx / d) * remaining
        this.segPos.north += (dy / d) * remaining
        remaining = 0
      }
    }
    this.pauseLeft = 0
    this.fixTimer = this.fixIntervalS // emit right away
  }

  /** Restart the scripted walk from the beginning. */
  resetSimulation(): void {
    // Laid out in metres around the preview origin (wearer starts at 0,0 facing north).
    // Starts ~183 m (600 ft) away, a little right of straight ahead, so the first
    // frame of the demo shows the beacon. Ends at the stage, ~35 m from the start.
    this.path = [
      {east: 32, north: 180, pauseS: 2},
      {east: 26, north: 140, pauseS: 0},
      {east: 14, north: 112, pauseS: 6}, // stops at a food truck
      {east: 9, north: 70, pauseS: 0},
      {east: 6, north: 38, pauseS: 4}, // waits by the stage
      {east: 2, north: 30, pauseS: 9999},
    ]
    this.segIndex = 0
    this.segPos = {east: this.path[0].east, north: this.path[0].north}
    this.pauseLeft = this.path[0].pauseS
    this.fixTimer = this.fixIntervalS - 0.4 // first fix ~0.4 s after start
    this.signalLost = false
    this.simEnded = false
    this.snapshot = {state: "waiting", name: this.friendName, fix: null, endedReason: null, message: null}
    this.startedAt = getTime()
    this._onStateChanged.invoke("waiting")
  }

  private stepSimulation(dt: number): void {
    if (this.simEnded) return
    // Walk
    if (this.pauseLeft > 0) {
      this.pauseLeft -= dt
      this.simSpeed = 0
    } else if (this.segIndex < this.path.length - 1) {
      const target = this.path[this.segIndex + 1]
      const dx = target.east - this.segPos.east
      const dy = target.north - this.segPos.north
      const d = Math.sqrt(dx * dx + dy * dy)
      const step = this.walkSpeedMps * dt
      this.simHeading = (Math.atan2(dx, dy) * 180) / Math.PI
      this.simSpeed = this.walkSpeedMps
      if (d <= step) {
        this.segPos = {east: target.east, north: target.north}
        this.segIndex++
        this.pauseLeft = target.pauseS
      } else {
        this.segPos.east += (dx / d) * step
        this.segPos.north += (dy / d) * step
      }
    }
    // Report
    this.fixTimer += dt
    if (this.fixTimer < this.fixIntervalS || this.signalLost) return
    this.fixTimer = 0
    const origin = this.wearerPose
    const acc = this.friendAccuracyM * (0.8 + 0.5 * this.rng())
    const nE = gaussian(this.rng) * acc * 0.5
    const nN = gaussian(this.rng) * acc * 0.5
    const ll = offsetLatLng(origin.originLat, origin.originLng, this.segPos.east + nE, this.segPos.north + nN)
    const fix: GeoFix = {
      lat: ll.lat,
      lng: ll.lng,
      accuracyM: acc,
      headingDeg: this.simSpeed > 0 ? this.simHeading : null,
      speedMps: this.simSpeed,
      timestampMs: Date.now(),
    }
    this.acceptFix(fix)
  }

  // ── Live MyLoco share ───────────────────────────────────────
  private async pollShare(): Promise<void> {
    try {
      const res = await this.internet.fetch(this.supabaseUrl + "/rest/v1/rpc/get_share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: this.anonKey,
          Authorization: "Bearer " + this.anonKey,
        },
        body: JSON.stringify({share_token: this.shareToken}),
      })
      if (res.status !== 200) {
        this.snapshot.message = "MyLoco error " + res.status
        this.setState(this.snapshot.fix ? this.snapshot.state : "error", null)
      } else {
        const j = await res.json()
        this.applyShare(j)
      }
    } catch (e) {
      this.snapshot.message = "Network: " + e
      print("[FriendFeed] poll failed: " + e)
    }
    if (this.snapshot.state !== "ended") this.pollEvent.reset(this.pollIntervalS)
  }

  private applyShare(j: any): void {
    if (!j || j.state === "not_found") {
      this.setState("ended", "not_found")
      return
    }
    if (j.state === "ended") {
      this.setState("ended", "expired")
      return
    }
    if (j.display_name) this.snapshot.name = j.display_name
    if (j.lat === null || j.lng === null || j.lat === undefined) return // active but no fix yet
    const ts = j.located_at ? Date.parse(j.located_at) : Date.now()
    if (this.snapshot.fix && this.snapshot.fix.timestampMs === ts) return // nothing new
    this.acceptFix({
      lat: j.lat,
      lng: j.lng,
      accuracyM: j.accuracy !== null && j.accuracy !== undefined ? j.accuracy : 15,
      headingDeg: j.heading !== null && j.heading !== undefined && j.heading >= 0 ? j.heading : null,
      speedMps: j.speed !== null && j.speed !== undefined && j.speed >= 0 ? j.speed : null,
      timestampMs: ts,
    })
  }

  // ── Shared ──────────────────────────────────────────────────
  private acceptFix(fix: GeoFix): void {
    this.snapshot.fix = fix
    if (this.snapshot.state !== "live") this.setState("live", null)
    this._onFix.invoke(fix)
  }

  private setState(state: FeedState, reason: string | null): void {
    if (this.snapshot.state === state) return
    this.snapshot.state = state
    this.snapshot.endedReason = reason
    print("[FriendFeed] state=" + state + (reason ? " (" + reason + ")" : ""))
    this._onStateChanged.invoke(state)
  }

  /** Debug: true distance (m) from preview origin to the simulated friend, no noise. */
  get simDistanceFromOrigin(): number {
    return enuLength(this.segPos)
  }
}
