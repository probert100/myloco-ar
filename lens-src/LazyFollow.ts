/**
 * LazyFollow — keeps a panel at a comfortable offset from the wearer (yaw only,
 * no head-locking) and lets it trail smoothly, so UI stays reachable while the
 * wearer walks across the festival grounds.
 */
import {faceCamera} from "./UiKitHelpers"

@component
export class LazyFollow extends BaseScriptComponent {
  @input
  @hint("The SPECS camera object.")
  camera: SceneObject

  @input
  @hint("Offset from the camera in its yaw frame (cm): x right, y up, z forward (negative = ahead).")
  offset: vec3 = new vec3(-22, -28, -75)

  @input
  @hint("How quickly the panel catches up (1/s).")
  followRate: number = 2.5

  @input
  @hint("Re-centre only when the panel drifts more than this many degrees from where it belongs.")
  yawDeadZoneDeg: number = 25

  private camT: Transform
  private tr: Transform
  private anchorYaw = 0
  private started = false

  onAwake(): void {
    if (isNull(this.camera)) return
    this.camT = this.camera.getTransform()
    this.tr = this.getTransform()
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  private tick(): void {
    const f = this.camT.forward
    const camYaw = Math.atan2(f.x, -f.z)
    if (!this.started) {
      this.anchorYaw = camYaw
    } else {
      let d = (camYaw - this.anchorYaw) * (180 / Math.PI)
      while (d > 180) d -= 360
      while (d < -180) d += 360
      if (Math.abs(d) > this.yawDeadZoneDeg) this.anchorYaw += (d * Math.PI / 180) * Math.min(1, getDeltaTime() * this.followRate)
    }
    const s = Math.sin(this.anchorYaw)
    const c = Math.cos(this.anchorYaw)
    // yaw frame: right = (c, 0, s), forward(-z) = (s, 0, -c)
    const o = this.offset
    const cam = this.camT.getWorldPosition()
    const target = new vec3(cam.x + c * o.x - s * o.z, cam.y + o.y, cam.z + s * o.x + c * o.z)
    if (!this.started) {
      this.tr.setWorldPosition(target)
      this.started = true
    } else {
      const k = Math.min(1, getDeltaTime() * this.followRate)
      this.tr.setWorldPosition(vec3.lerp(this.tr.getWorldPosition(), target, k))
    }
    faceCamera(this.tr, cam)
  }
}
