/**
 * WearerPose — where the SPECS wearer is and which way is north.
 *
 * This is the "WearerPose seam" from the design brief. Lens Studio's preview
 * can't move GPS (it pins location to a fixed spot) and its compass heading
 * turns the wrong way, so:
 *
 *   - Preview mode: position + heading come from the preview camera transform.
 *     Walking with WASD = walking across the festival grounds. World -Z = north.
 *   - Device mode: position + heading come from LocationService (Navigation
 *     accuracy) and the north-aligned orientation, the real SPECS APIs.
 *
 * Everything downstream asks this one component for a pose, and nothing else
 * changes between preview and hardware.
 */
require("LensStudio:RawLocationModule")

import {angleDiffDeg, offsetLatLng, worldYawDeg, wrap360} from "./GeoMath"

export interface WearerPoseSample {
  lat: number
  lng: number
  accuracyM: number
  /** Camera position in world space (cm). */
  worldPos: vec3
  /** World Y of the ground under the wearer (cm). */
  groundY: number
  /**
   * Compass bearing = worldYaw + northOffsetDeg. Zero in preview (world -Z is
   * north by construction); on device it is learned from the compass.
   */
  northOffsetDeg: number
  /** Compass heading the wearer is facing. */
  headingDeg: number
  source: "preview" | "device"
  ready: boolean
}

@component
export class WearerPose extends BaseScriptComponent {
  @ui.label('<span style="color: #FF7A59;">WearerPose – preview camera vs. real GPS/compass</span>')
  @ui.separator
  @input
  @hint("The SPECS camera (the object with Camera + DeviceTracking).")
  camera: SceneObject

  @input
  @hint("Auto = preview camera in Lens Studio, real GPS on SPECS. Force a mode for testing.")
  @widget(new ComboBoxWidget([new ComboBoxItem("Auto", 0), new ComboBoxItem("Preview camera", 1), new ComboBoxItem("Device GPS", 2)]))
  mode: number = 0

  @ui.group_start("Preview origin")
  @input
  @hint("Latitude the preview world origin maps to (default: Dorothea Dix Park, Raleigh NC).")
  originLat: number = 35.7714

  @input
  @hint("Longitude the preview world origin maps to.")
  originLng: number = -78.6619

  @input
  @hint("Simulated wearer GPS accuracy in preview (metres, 1-sigma).")
  previewAccuracyM: number = 6
  @ui.group_end

  @input
  @hint("Eye height above the ground (cm). Used to place things on the floor.")
  eyeHeightCm: number = 160

  private camT: Transform
  private usingDevice = false
  private locationService: LocationService
  private lastFix: {lat: number; lng: number; acc: number} | null = null
  private compassHeading: number | null = null
  private northOffset = 0
  private northOffsetInit = false
  private pollEvent: DelayedCallbackEvent

  onAwake(): void {
    if (isNull(this.camera)) {
      print("[WearerPose] ERROR: camera not assigned")
      return
    }
    this.camT = this.camera.getTransform()
    const isEditor = global.deviceInfoSystem.isEditor()
    this.usingDevice = this.mode === 2 || (this.mode === 0 && !isEditor)
    if (this.usingDevice) this.startDeviceLocation()
    this.createEvent("UpdateEvent").bind(() => this.updateNorthOffset())
    print("[WearerPose] source=" + (this.usingDevice ? "device" : "preview"))
  }

  get source(): "preview" | "device" {
    return this.usingDevice ? "device" : "preview"
  }

  getPose(): WearerPoseSample {
    const p = this.camT.getWorldPosition()
    const f = this.camT.back // camera view direction (local -Z)
    const camYaw = worldYawDeg(f.x, f.z)
    const groundY = p.y - this.eyeHeightCm
    if (!this.usingDevice) {
      // World origin == geo origin; world -Z == north; 1 cm == 1 cm.
      const ll = offsetLatLng(this.originLat, this.originLng, p.x / 100, -p.z / 100)
      return {
        lat: ll.lat,
        lng: ll.lng,
        accuracyM: this.previewAccuracyM,
        worldPos: p,
        groundY,
        northOffsetDeg: 0,
        headingDeg: wrap360(camYaw),
        source: "preview",
        ready: true,
      }
    }
    const fix = this.lastFix
    return {
      lat: fix ? fix.lat : 0,
      lng: fix ? fix.lng : 0,
      accuracyM: fix ? fix.acc : 999,
      worldPos: p,
      groundY,
      northOffsetDeg: this.northOffset,
      headingDeg: wrap360(camYaw + this.northOffset),
      source: "device",
      ready: fix !== null && this.northOffsetInit,
    }
  }

  // ── Device path ─────────────────────────────────────────────
  private startDeviceLocation(): void {
    this.locationService = GeoLocation.createLocationService()
    this.locationService.accuracy = GeoLocationAccuracy.Navigation
    this.locationService.onNorthAlignedOrientationUpdate.add((orientation) => {
      this.compassHeading = GeoLocation.getNorthAlignedHeading(orientation)
    })
    this.pollEvent = this.createEvent("DelayedCallbackEvent")
    this.pollEvent.bind(() => this.poll())
    this.pollEvent.reset(0)
  }

  private poll(): void {
    this.locationService.getCurrentPosition(
      (pos) => {
        this.lastFix = {lat: pos.latitude, lng: pos.longitude, acc: pos.horizontalAccuracy}
        this.pollEvent.reset(1.0)
      },
      (err) => {
        print("[WearerPose] location error: " + err)
        this.pollEvent.reset(1.0)
      }
    )
  }

  /**
   * Learn the offset between world yaw and compass heading, low-pass filtered
   * on the circle so compass noise doesn't swing the beacon around.
   */
  private updateNorthOffset(): void {
    if (!this.usingDevice || this.compassHeading === null) return
    const f = this.camT.back // camera view direction (local -Z)
    const camYaw = worldYawDeg(f.x, f.z)
    const target = wrap360(this.compassHeading - camYaw)
    if (!this.northOffsetInit) {
      this.northOffset = target
      this.northOffsetInit = true
      return
    }
    const k = Math.min(1, getDeltaTime() * 0.5) // ~2 s time constant
    this.northOffset = wrap360(this.northOffset + angleDiffDeg(target, this.northOffset) * k)
  }
}
