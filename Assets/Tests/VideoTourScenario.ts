/**
 * Video tour: the camera moves and button presses for the submission video,
 * as a LEAF scenario so the recording is repeatable. It is the shot list from
 * devpost/submission.md, not a done-criterion test, but it still checks the
 * states it shows (bands, stale, ended) and fails if one doesn't happen.
 *
 * Times inside a shot are seconds into that shot's voice-over line (from the
 * ElevenLabs word alignment), so a look or a pinch lands on the words that
 * describe it. Each shot prints "[Tour] mark <shot> <t> lead=<s> tau0=<s>"
 * (t = seconds since the tour started) so the edit can cut the recording to
 * the voice-over, and every pinch prints "[Tour] tap <button> <t> <x> <y>"
 * with the button's screen position for the on-screen pinch highlight.
 * Actions between shots (pre-positioning, unmute, restart) are cut from the video.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {findInteractablesByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {makeDiscMesh} from "../Scripts/Meshes"
import {MyLocoLeafInteractor, lens, openSessionPanel, waitFor} from "./MyLocoLeaf"

const DEG = Math.PI / 180
/** Footage before each voice line starts, and after it ends (s). */
const LEAD = 0.6
const TAIL = 0.9
/** Pitch that brings the panels below eye level into view (deg, negative = down). */
const GLANCE = -24
/** Seconds to hold before the tour starts (the MCP run call times out after ~60 s). */
const HOLD_S = 80
/** Timecode: bits of tour time (centiseconds) drawn as discs along the top edge, between two always-white guards. */
const TC_BITS = 16

/** Voice-over line lengths (s), from the generated ElevenLabs files. */
const VO = {
  s01: 12.12,
  s02: 14.76,
  s03: 6.69,
  s04: 15.44,
  s05: 12.51,
  s06: 11.23,
  s07: 10.03,
  s08: 6.84,
  s09: 4.28,
  s11: 2.35,
}

const ease = (k: number): number => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)))

async function tween(durS: number, f: (k: number) => void): Promise<void> {
  const t0 = getTime()
  for (;;) {
    const k = durS <= 0 ? 1 : (getTime() - t0) / durS
    f(ease(k))
    if (k >= 1) return
    await sleep(15)
  }
}

/** Camera parent rig: yaw/pitch and walking, since Device Tracking owns the camera's own transform. */
class TourRig {
  private tr: Transform
  private camT: Transform
  readonly cam: Camera
  yaw = 0
  pitch = 0

  constructor() {
    const camObj = findSceneObjectByName("Camera Object")
    if (!camObj) throw new Error('Scene object "Camera Object" not found')
    const rig = global.scene.createSceneObject("LeafTourRig")
    camObj.setParent(rig)
    this.tr = rig.getTransform()
    this.camT = camObj.getTransform()
    this.cam = camObj.getComponent("Component.Camera")
  }

  get pos(): vec3 {
    return this.tr.getWorldPosition()
  }

  set pos(p: vec3) {
    this.tr.setWorldPosition(p)
  }

  apply(): void {
    const q = quat.angleAxis(-this.yaw * DEG, vec3.up()).multiply(quat.angleAxis(this.pitch * DEG, vec3.right()))
    this.tr.setWorldRotation(q)
  }

  async look(yaw: number, pitch: number, durS: number): Promise<void> {
    const y0 = this.yaw
    const p0 = this.pitch
    await tween(durS, (k) => {
      this.yaw = y0 + (yaw - y0) * k
      this.pitch = p0 + (pitch - p0) * k
      this.apply()
    })
  }

  /** Walk `metres` along a heading (deg) with a gentle start and stop. */
  async walk(headingDeg: number, metres: number, durS: number): Promise<void> {
    const from = this.pos
    const to = from.add(new vec3(Math.sin(headingDeg * DEG), 0, -Math.cos(headingDeg * DEG)).uniformScale(metres * 100))
    await tween(durS, (k) => {
      this.pos = vec3.lerp(from, to, k)
    })
  }

  /** Heading (deg, 0 = north / world -Z, clockwise) from the camera to a world point. */
  yawTo(p: vec3): number {
    const c = this.camT.getWorldPosition()
    return Math.atan2(p.x - c.x, -(p.z - c.z)) / DEG
  }

  /** Heading to a scene object (e.g. a panel that trails the head), so a glance lands on it. */
  yawToObject(name: string): number {
    return this.yawTo(findSceneObjectByName(name).getTransform().getWorldPosition())
  }

  /** Horizontal distance from the camera to a world point (m). */
  distTo(p: vec3): number {
    const c = this.camT.getWorldPosition()
    return Math.sqrt((p.x - c.x) * (p.x - c.x) + (p.z - c.z) * (p.z - c.z)) / 100
  }
}

@component
export class VideoTourScenario extends Scenario {
  private ix = new MyLocoLeafInteractor()
  private rig: TourRig
  private T0 = 0
  private shotStart = 0
  private lead = LEAD
  private tau0 = 0
  private tcMats: Material[] = []

  private now(): number {
    return getTime() - this.T0
  }

  private mark(shot: string, tau0: number = 0, lead: number = LEAD): void {
    this.shotStart = getTime()
    this.tau0 = tau0
    this.lead = lead
    const c = lens.controller()
    print(`[Tour] mark ${shot} ${this.now().toFixed(3)} lead=${lead} tau0=${tau0} state=${c.state}`)
  }

  /** Wait until `tau` seconds into the current shot's voice line. */
  private async at(tau: number): Promise<void> {
    const target = this.shotStart + this.lead + (tau - this.tau0)
    while (getTime() < target) await sleep(10)
  }

  /**
   * The preview recorder stamps frames at a fixed 30 fps whatever the render rate,
   * so the tour draws its own clock into every frame: a row of black/white discs
   * at the very top of the view (cropped off in the edit) encoding tour time.
   */
  private makeTimecode(): void {
    const camObj = findSceneObjectByName("Camera Object")
    const cam = camObj.getComponent("Component.Camera")
    const z = 60
    const halfH = Math.tan(cam.fov / 2) * z
    const halfW = halfH * cam.aspect
    print(`[Tour] camera fov=${(cam.fov / DEG).toFixed(2)} aspect=${cam.aspect.toFixed(4)}`)
    const n = TC_BITS + 2
    const spacing = (2 * halfW * 0.7) / n
    const r = spacing * 0.36
    const disc = makeDiscMesh(16)
    const base = lens.beacon().baseMaterial
    for (let i = 0; i < n; i++) {
      const so = global.scene.createSceneObject("LeafTourTimecode" + i)
      so.setParent(camObj)
      const tr = so.getTransform()
      tr.setLocalPosition(new vec3((i - (n - 1) / 2) * spacing, halfH - r * 1.6, -z))
      tr.setLocalRotation(quat.angleAxis(Math.PI / 2, vec3.right()))
      tr.setLocalScale(new vec3(r, 1, r))
      const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      rmv.mesh = disc
      const m = base.clone()
      m.mainPass.blendMode = BlendMode.Normal
      m.mainPass.twoSided = true
      m.mainPass.depthTest = false
      m.mainPass.depthWrite = false
      m.mainPass.baseColor = new vec4(1, 1, 1, 1)
      rmv.mainMaterial = m
      rmv.setRenderOrder(10000)
      this.tcMats.push(m)
    }
    const white = new vec4(1, 1, 1, 1)
    const black = new vec4(0, 0, 0, 1)
    this.createEvent("UpdateEvent").bind(() => {
      const v = Math.max(0, Math.round((getTime() - this.T0) * 100)) & 0xffff
      for (let b = 0; b < TC_BITS; b++) this.tcMats[1 + b].mainPass.baseColor = (v >> (TC_BITS - 1 - b)) & 1 ? white : black
    })
  }

  private async tap(name: string): Promise<void> {
    const it = findInteractablesByName(name, undefined, true)[0]
    if (it) {
      const sp = this.rig.cam.worldSpaceToScreenSpace(it.getSceneObject().getTransform().getWorldPosition())
      print(`[Tour] tap ${name} ${this.now().toFixed(3)} ${sp.x.toFixed(4)} ${sp.y.toFixed(4)}`)
    }
    await this.ix.tapButton(name)
  }

  async run(): Promise<void> {
    // The LEAF status strip would sit on top of the footage.
    const overlay = findSceneObjectByName("LeafDebugUICamera")
    if (overlay) overlay.enabled = false

    this.rig = new TourRig()
    this.T0 = getTime()
    this.makeTimecode()
    const c = lens.controller()
    const b = lens.beacon()
    expect(await waitFor(() => c.state === "live-far-live", 4000)).toBe(true)

    // Starting a scenario resets the preview, which cancels a preview video
    // recording, so the tour holds (facing away) while the recording is started
    // after the reset. Then Restart replays the friend's walk from the top.
    this.rig.yaw = 180
    this.rig.apply()
    print(`[Tour] holding ${HOLD_S} s: start the preview recording now`)
    while (this.now() < HOLD_S) await sleep(100)
    await this.tap("Button_Restart")
    expect(await waitFor(() => c.state === "live-far-live", 4000)).toBe(true)
    expect(await waitFor(() => b.farWeight > 0.95, 4000)).toBe(true)
    await sleep(1000)
    const startYaw = this.rig.yawTo(b.labelAnchor)
    // Sync cut: snap from facing away to the beacon in one frame; the edit finds
    // this frame in the recording to line the marks up with the video.
    this.rig.yaw = startYaw - 9
    this.rig.apply()
    print(`[Tour] sync ${this.now().toFixed(3)}`)
    await sleep(1200)

    // 1. The beacon, ~600 ft away. The view drifts to centre it.
    this.mark("s01_intro")
    const drift = this.rig.look(startYaw - 1, 0, VO.s01)
    await this.at(VO.s01 + TAIL)
    await drift

    // 2. Look around the crowd; the beacon stays put in the world.
    this.mark("s02_anyone")
    await this.at(0.4)
    await this.rig.look(startYaw - 40, 1, 4.4)
    await this.at(5.6)
    await this.rig.look(startYaw + 34, 0, 5.2)
    await this.at(11.4)
    await this.rig.look(startYaw, 0, 2.8)
    await this.at(VO.s02 + TAIL)

    // 3. Turn away: the edge arrow; turn back: it goes.
    this.mark("s03_arrow")
    await this.at(0.2)
    await this.rig.look(startYaw + 95, 0, 1.3)
    await this.at(3.6)
    print(`[Tour] arrow weight turned away: ${b.arrowWeight.toFixed(2)}`)
    expect(b.arrowWeight).toBeGreaterThan(0.8)
    await this.at(4.6)
    await this.rig.look(startYaw, 0, 1.4)
    await this.at(VO.s03 + TAIL)

    // 4. Walk toward her; glance down at the yellow preview panel; Skip closer.
    this.mark("s04_walk")
    await this.at(0.1)
    const heading = this.rig.yawTo(b.labelAnchor)
    const walk = this.rig.walk(heading, 10, 7.6)
    await this.rig.look(heading, 0, 1.5)
    await walk
    await this.at(11.4)
    await this.rig.look(this.rig.yawToObject("PreviewControls"), GLANCE, 1.0)
    await this.at(14.3)
    await this.tap("Button_Skipcloser")
    // One pinch moves her 40 m along her walk. A second one can leave her ~20 m away, where
    // 10 m of GPS noise briefly reads as the Here band; so if one pinch leaves her just
    // outside 75 m, look up and take a few steps in instead.
    let lookUp: Promise<void> = Promise.resolve()
    if (!(await waitFor(() => c.band === "near", 1500))) {
      lookUp = this.rig.look(this.rig.yawTo(b.labelAnchor), -3, 1.0)
      for (let i = 0; i < 8 && c.band !== "near"; i++) await this.rig.walk(this.rig.yawTo(b.labelAnchor), 2.5, 0.9)
    }
    expect(await waitFor(() => c.band === "near", 3000)).toBe(true)
    await lookUp
    lookUp = this.rig.look(this.rig.yawTo(b.labelAnchor), -3, 1.1)
    await this.at(VO.s04 + 0.2)

    // 5. Near band: person marker inside the uncertainty ring.
    this.mark("s05_near", 0, 0.3)
    await lookUp
    await this.at(3.4)
    await this.rig.look(this.rig.yawTo(b.labelAnchor), -9, 1.6)
    await this.at(9.6)
    await this.rig.look(this.rig.yawTo(b.labelAnchor) + 5, -6, 2.2)
    await this.at(VO.s05 + TAIL)
    expect(c.band).toBe("near")

    // 6a. Signal lost.
    this.mark("s06_stale")
    const herYaw = this.rig.yawTo(b.labelAnchor)
    await this.rig.look(this.rig.yawToObject("PreviewControls"), GLANCE, 0.9)
    await this.tap("Button_Signallost")
    await this.rig.look(herYaw, -4, 0.9)
    await this.at(4.2)
    print(`[Tour] cut s06 ${this.now().toFixed(3)} (waiting for the fix to go stale)`)
    // 6b. ~20 s later: hollow marker, "last seen N s ago" counting. Then Restore.
    expect(await waitFor(() => c.state === "live-near-stale", 30000, 100)).toBe(true)
    await sleep(1300)
    this.mark("s06b", 4.3, 0)
    print(`[Tour] stale chip: ${lens.label().statusLine}`)
    await this.at(8.6)
    await this.rig.look(this.rig.yawToObject("PreviewControls"), GLANCE, 0.8)
    await this.tap("Button_Signallost") // now reads "Restore"
    await this.rig.look(herYaw, -4, 0.8)
    await this.at(VO.s06 + 1.6)
    print(`[Tour] after restore: ${c.state} · ${lens.label().statusLine}`)

    // Between shots (cut): stand ~17 m from her so a few steps cross into Here on cue.
    expect(await waitFor(() => c.state === "live-near-live", 4000)).toBe(true)
    {
      const a = b.labelAnchor
      const d = this.rig.distTo(a)
      const h = this.rig.yawTo(a)
      const p = this.rig.pos
      const move = (d - 17) * 100
      this.rig.pos = p.add(new vec3(Math.sin(h * DEG), 0, -Math.cos(h * DEG)).uniformScale(move))
      this.rig.yaw = h
      this.rig.pitch = 0
      this.rig.apply()
      await sleep(1800)
      expect(c.band).toBe("near")
    }

    // 7. Walk into the Here band: ring around the wearer, "Look around."
    this.mark("s07_here")
    const toHer = this.rig.yawTo(b.labelAnchor)
    await this.rig.walk(toHer, Math.max(0, this.rig.distTo(b.labelAnchor) - 9), 3.0)
    expect(await waitFor(() => c.band === "here", 3000)).toBe(true)
    print(`[Tour] here band, HUD: ${lens.hud().headline}`)
    await this.at(4.2)
    await this.rig.look(toHer, -5, 1.0)
    await this.at(6.7)
    await this.rig.look(toHer - 22, -2, 1.2)
    await this.rig.look(toHer + 14, 0, 1.6)
    await this.at(VO.s07 + TAIL)

    // 8. The wearer's own controls: Mute and End.
    this.mark("s08_controls")
    const yaw8 = this.rig.yaw
    await this.rig.look(this.rig.yawToObject("Session"), GLANCE, 1.0)
    if (!lens.session().isExpanded) await this.tap("Button_MyLoco")
    await this.at(2.5)
    await this.tap("Button_Mute")
    expect(c.isMuted).toBe(true)
    await this.at(5.0)
    await this.rig.look(yaw8, 0, 1.0)
    await this.at(VO.s08 + TAIL)
    // Between shots (cut): unmute so the share-ended cue is heard.
    await openSessionPanel(this.ix)
    await this.ix.tapButton("Button_Mute")
    expect(c.isMuted).toBe(false)
    await sleep(600)

    // 9. Maya stops sharing.
    this.mark("s09_ended", 0, 0.3)
    const yaw9 = this.rig.yaw
    await this.rig.look(this.rig.yawToObject("PreviewControls"), GLANCE, 0.7)
    await this.tap("Button_Endshare")
    await this.rig.look(yaw9, -2, 0.8)
    expect(await waitFor(() => c.state === "ended", 1000)).toBe(true)
    print(`[Tour] ended, HUD: ${lens.hud().headline}`)
    await this.at(VO.s09 + 1.4)

    // Between shots (cut): Restart and stand back at the start for the closing shot.
    await this.tap("Button_Restart")
    this.rig.pos = vec3.zero()
    this.rig.pitch = 0
    this.rig.apply()
    expect(await waitFor(() => c.state === "live-far-live", 4000)).toBe(true)
    expect(await waitFor(() => b.farWeight > 0.95, 4000)).toBe(true)
    this.rig.yaw = this.rig.yawTo(b.labelAnchor) - 6
    this.rig.apply()
    await sleep(1500)

    // 11. Closing shot: the beacon again.
    this.mark("s11_outro")
    const endYaw = this.rig.yawTo(b.labelAnchor)
    await this.rig.look(endYaw, 0, VO.s11 + 2.0)
    await this.at(VO.s11 + 1.8)
    print(`[Tour] done ${this.now().toFixed(3)}`)
  }
}
