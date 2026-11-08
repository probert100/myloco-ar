/**
 * BeaconView — everything drawn in the world for the friend:
 *   Far  : a tall coral light pillar standing on their bearing over the crowd,
 *          rendered at most `farRenderDistanceM` away and scaled to keep a fixed
 *          angular height (so it's visible at 600 ft without clipping).
 *   Near : a person-height marker at their smoothed position, with a ground ring
 *          whose radius is the combined GPS uncertainty of both people.
 *   Here : the marker hides; a ring on the ground around the wearer says
 *          "they're within this circle — look around".
 *   Off-view arrow: a small chevron at the edge of the view pointing the way.
 * Bands cross-fade; stale data is drawn hollow and dim, never as if live.
 */
import {Band, Freshness} from "./FriendTracker"
import {makeChevronMesh, makeCylinderMesh, makeRingMesh, makeSphereMesh} from "./Meshes"

export interface BeaconFrame {
  /** Show anything at all (false = waiting / ended → fade out). */
  active: boolean
  band: Band
  freshness: Freshness
  distanceM: number
  /** Unit world direction (x, z) from wearer toward the friend. */
  dirX: number
  dirZ: number
  groundY: number
  uncertaintyM: number
  hereRadiusM: number
}

interface Visual {
  so: SceneObject
  rmv: RenderMeshVisual
  mat: Material
  baseAlpha: number
}

@component
export class BeaconView extends BaseScriptComponent {
  @ui.label('<span style="color: #FF7A59;">BeaconView – pillar, marker, rings, off-view arrow</span>')
  @ui.separator
  @input
  @hint("The SPECS camera object.")
  camera: SceneObject

  @input
  @hint("Unlit material to clone for every beacon visual (color is set per clone).")
  baseMaterial: Material

  @input("vec3", "{1.0,0.42,0.30}")
  @widget(new ColorWidget())
  @hint("Beacon colour (MyLoco coral). Bright colours read best on the additive display.")
  beaconColor: vec3

  @input("vec3", "{0.70,0.62,0.60}")
  @widget(new ColorWidget())
  @hint("Colour used when the friend's location is stale.")
  staleColor: vec3

  @ui.group_start("Sizing")
  @input
  @hint("Far band: the pillar is drawn at most this far away (m) and scaled to keep its angular size.")
  farRenderDistanceM: number = 40

  @input
  @hint("Far band: how far above the horizon the pillar top reaches (degrees).")
  farAngularHeightDeg: number = 12

  @input
  @hint("Near band: real-world marker height (cm).")
  markerHeightCm: number = 180

  @input
  @hint("Near band: minimum angular height of the marker (degrees) so it stays findable at 70 m.")
  markerMinAngleDeg: number = 2.5

  @input
  @hint("Off-view arrow appears when the friend is more than this many degrees off-centre.")
  arrowThresholdDeg: number = 15
  @ui.group_end

  private camT: Transform
  private root: SceneObject
  private shell: Visual
  private core: Visual
  private footRing: Visual
  private markerBody: Visual
  private markerHead: Visual
  private uncRing: Visual
  private hereRing: Visual
  private arrow: Visual

  private farA = 0
  private nearA = 0
  private hereA = 0
  private arrowA = 0
  private fresh = 1
  private t = 0

  /** World position of the visual's focus (beacon mid-height / marker head), for labels. */
  labelAnchor: vec3 = vec3.zero()
  /** Scale factor so a 110 cm-calibrated UI keeps its apparent size at the anchor. */
  labelScale = 1
  /** True if the friend's direction is within the view. */
  inView = true

  // ── Read-only state (LEAF scenarios + debugging) ──
  /** Cross-fade weight of the far pillar, 0..1. */
  get farWeight(): number { return this.farA }
  /** Cross-fade weight of the near person marker + uncertainty ring, 0..1. */
  get nearWeight(): number { return this.nearA }
  /** Cross-fade weight of the "here" ring around the wearer, 0..1. */
  get hereWeight(): number { return this.hereA }
  /** Fade weight of the off-view arrow, 0..1. */
  get arrowWeight(): number { return this.arrowA }
  /** Freshness brightness: 1 = live, ~0.45 = stale, ~0.2 = old. */
  get freshWeight(): number { return this.fresh }
  /** True while the solid inner core is drawn (live). Stale beacons are hollow (shell only). */
  get coreVisible(): boolean { return this.core ? this.core.so.enabled : false }

  onAwake(): void {
    if (isNull(this.camera) || isNull(this.baseMaterial)) {
      print("[BeaconView] ERROR: camera/baseMaterial not assigned")
      return
    }
    this.camT = this.camera.getTransform()
    this.root = this.getSceneObject()
    const cyl = makeCylinderMesh(32)
    const taper = makeCylinderMesh(32, 0.55)
    const ring = makeRingMesh(0.9)
    const thinRing = makeRingMesh(0.96, 96)
    const sphere = makeSphereMesh()
    this.shell = this.makeVisual("BeaconShell", cyl, 0.32)
    this.core = this.makeVisual("BeaconCore", cyl, 0.85)
    this.footRing = this.makeVisual("BeaconFootRing", ring, 0.8)
    this.markerBody = this.makeVisual("MarkerBody", taper, 0.85)
    this.markerHead = this.makeVisual("MarkerHead", sphere, 0.9)
    this.uncRing = this.makeVisual("UncertaintyRing", thinRing, 0.75)
    this.hereRing = this.makeVisual("HereRing", thinRing, 0.9)
    this.arrow = this.makeVisual("OffViewArrow", makeChevronMesh(), 0.95)
    // The arrow is screen-adjacent: draw it last and don't let it depth-test against the world.
    this.arrow.mat.mainPass.depthTest = false
    this.setAlpha(this.shell, 0)
    this.setAlpha(this.core, 0)
  }

  private makeVisual(name: string, mesh: RenderMesh, baseAlpha: number): Visual {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.root)
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = mesh
    const mat = this.baseMaterial.clone()
    // Fades go through baseColor alpha, so the clone must alpha-blend (the Unlit preset ships with blending Disabled).
    mat.mainPass.blendMode = BlendMode.Normal
    mat.mainPass.twoSided = true
    mat.mainPass.depthWrite = false
    rmv.mainMaterial = mat
    const v: Visual = {so, rmv, mat, baseAlpha}
    this.setAlpha(v, 0)
    return v
  }

  private setAlpha(v: Visual, a: number, color?: vec3): void {
    const c = color ? color : this.beaconColor
    v.mat.mainPass.baseColor = new vec4(c.x, c.y, c.z, v.baseAlpha * a)
    v.so.enabled = a > 0.01
  }

  render(f: BeaconFrame, dt: number): void {
    if (!this.camT) return
    this.t += dt
    const k = Math.min(1, dt * 3)
    const on = f.active ? 1 : 0
    this.farA += ((f.band === "far" ? on : 0) - this.farA) * k
    this.nearA += ((f.band === "near" ? on : 0) - this.nearA) * k
    this.hereA += ((f.band === "here" ? on : 0) - this.hereA) * k
    const freshTarget = f.freshness === "live" ? 1 : f.freshness === "stale" ? 0.6 : 0.25
    this.fresh += (freshTarget - this.fresh) * k
    const color = f.freshness === "live" ? this.beaconColor : this.staleColor
    const live = f.freshness === "live" ? 1 : 0

    const cam = this.camT.getWorldPosition()
    const eyeAboveGround = Math.max(100, cam.y - f.groundY)
    const DEG = Math.PI / 180

    // ── Far: pillar ──
    const R = Math.min(f.distanceM, this.farRenderDistanceM) * 100
    const foot = new vec3(cam.x + f.dirX * R, f.groundY, cam.z + f.dirZ * R)
    const pillarH = eyeAboveGround + R * Math.tan(this.farAngularHeightDeg * DEG)
    const pillarR = Math.max(25, R * Math.tan(0.7 * DEG))
    const pulse = 1 + 0.06 * Math.sin(this.t * 2.4)
    this.place(this.shell, foot, new vec3(pillarR * 1.8 * pulse, pillarH, pillarR * 1.8 * pulse))
    this.place(this.core, foot, new vec3(pillarR * 0.6, pillarH * 1.02, pillarR * 0.6))
    this.place(this.footRing, new vec3(foot.x, foot.y + 2, foot.z), new vec3(pillarR * 4 * pulse, 1, pillarR * 4 * pulse))
    this.setAlpha(this.shell, this.farA * this.fresh, color)
    this.setAlpha(this.core, this.farA * this.fresh * live, color) // hollow when stale
    this.setAlpha(this.footRing, this.farA * this.fresh, color)

    // ── Near: marker + uncertainty ring ──
    const D = f.distanceM * 100
    const mFoot = new vec3(cam.x + f.dirX * D, f.groundY, cam.z + f.dirZ * D)
    const mH = Math.max(this.markerHeightCm, D * Math.tan(this.markerMinAngleDeg * DEG))
    this.place(this.markerBody, mFoot, new vec3(mH * 0.13, mH * 0.82, mH * 0.13))
    this.place(this.markerHead, new vec3(mFoot.x, mFoot.y + mH * 0.92, mFoot.z), new vec3(mH * 0.1, mH * 0.1, mH * 0.1))
    const uR = f.uncertaintyM * 100
    this.place(this.uncRing, new vec3(mFoot.x, f.groundY + 3, mFoot.z), new vec3(uR, 1, uR))
    this.setAlpha(this.markerBody, this.nearA * this.fresh, color)
    this.setAlpha(this.markerHead, this.nearA * this.fresh * (0.4 + 0.6 * live), color)
    this.setAlpha(this.uncRing, this.nearA * this.fresh, color)

    // ── Here: ring around the wearer ──
    const hR = f.hereRadiusM * 100 * (1 + 0.03 * Math.sin(this.t * 3))
    this.place(this.hereRing, new vec3(cam.x, f.groundY + 3, cam.z), new vec3(hR, 1, hR))
    this.setAlpha(this.hereRing, this.hereA * this.fresh, color)

    // Label anchor follows whichever visual is dominant.
    if (f.band === "far") {
      this.labelAnchor = new vec3(foot.x, cam.y - 0.15 * R * Math.tan(8 * DEG), foot.z)
      this.labelScale = R / 110
    } else {
      // Sit the chip just above the marker's head: ~3.6 cm is half the chip's height before scaling.
      this.labelScale = Math.max(1, D / 110)
      this.labelAnchor = new vec3(mFoot.x, f.groundY + mH * 1.05 + 3.6 * this.labelScale, mFoot.z)
    }

    // ── Off-view arrow ──
    this.updateArrow(f, dt)
  }

  private place(v: Visual, pos: vec3, scale: vec3): void {
    const tr = v.so.getTransform()
    tr.setWorldPosition(pos)
    tr.setWorldRotation(quat.quatIdentity())
    tr.setWorldScale(scale)
  }

  private updateArrow(f: BeaconFrame, dt: number): void {
    const fwd = this.camT.back // a Lens Studio camera looks down its local -Z, i.e. Transform.back
    const right = this.camT.right
    const camYaw = Math.atan2(fwd.x, -fwd.z)
    const tgtYaw = Math.atan2(f.dirX, -f.dirZ)
    let dYaw = (tgtYaw - camYaw) * (180 / Math.PI)
    while (dYaw > 180) dYaw -= 360
    while (dYaw < -180) dYaw += 360
    this.inView = Math.abs(dYaw) < this.arrowThresholdDeg
    const want = f.active && !this.inView && f.band !== "here" ? 1 : 0
    this.arrowA += (want - this.arrowA) * Math.min(1, dt * 6)
    this.setAlpha(this.arrow, this.arrowA)
    if (this.arrowA < 0.01) return
    const side = dYaw > 0 ? 1 : -1
    const cam = this.camT.getWorldPosition()
    // 70 cm ahead, ~11 cm to the side, slightly below centre: inside the narrow view.
    const pos = cam.add(fwd.uniformScale(70)).add(right.uniformScale(side * 11)).add(this.camT.up.uniformScale(-2))
    const tr = this.arrow.so.getTransform()
    tr.setWorldPosition(pos)
    // Chevron points +Y in its plane; roll it to point left/right.
    const roll = quat.angleAxis(-side * Math.PI * 0.5, new vec3(0, 0, 1))
    tr.setWorldRotation(this.camT.getWorldRotation().multiply(roll))
    const s = 2.2 + 0.25 * Math.sin(this.t * 6)
    tr.setWorldScale(new vec3(s, s, s))
  }
}
