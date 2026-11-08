/**
 * Shared LEAF helpers for the MyLoco AR scenarios: typed lookups of the Lens's
 * components (by the exact scene-object names the bootstrap created), a button
 * interactor for the UIKit buttons, and small polling/parsing utilities.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractablesByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {BeaconLabelUI} from "../Scripts/BeaconLabelUI"
import {BeaconView} from "../Scripts/BeaconView"
import {FriendFeed} from "../Scripts/FriendFeed"
import {HudUI} from "../Scripts/HudUI"
import {MeetMeThere} from "../Scripts/MeetMeThere"
import {SessionUI} from "../Scripts/SessionUI"
import {WearerPose} from "../Scripts/WearerPose"

export class MyLocoLeafInteractor extends DefaultLeafInteractor {
  /** Pinch a UIKit Button by its scene-object name (e.g. "Button_Skipcloser"). */
  async tapButton(buttonName: string): Promise<void> {
    const button = findInteractablesByName(buttonName, undefined, true)[0]
    if (!button) throw new Error(`Button "${buttonName}" not found or not enabled`)
    await this.trigger(button)
    await sleep(250)
  }
}

function comp<T>(objectName: string, typeName: unknown): T {
  const so = findSceneObjectByName(objectName)
  if (!so) throw new Error(`Scene object "${objectName}" not found`)
  const c = so.getComponent(typeName as any) as unknown as T
  if (!c) throw new Error(`Component ${typeName} not found on "${objectName}"`)
  return c
}

export const lens = {
  controller: () => comp<MeetMeThere>("Controller", MeetMeThere.getTypeName()),
  pose: () => comp<WearerPose>("WearerPose", WearerPose.getTypeName()),
  feed: () => comp<FriendFeed>("FriendFeed", FriendFeed.getTypeName()),
  beacon: () => comp<BeaconView>("BeaconView", BeaconView.getTypeName()),
  label: () => comp<BeaconLabelUI>("BeaconLabel", BeaconLabelUI.getTypeName()),
  hud: () => comp<HudUI>("Hud", HudUI.getTypeName()),
  session: () => comp<SessionUI>("Session", SessionUI.getTypeName()),
}

/** Poll until cond() is true or the timeout passes. Returns whether it became true. */
export async function waitFor(cond: () => boolean, timeoutMs: number, stepMs: number = 100): Promise<boolean> {
  let waited = 0
  while (waited <= timeoutMs) {
    if (cond()) return true
    await sleep(stepMs)
    waited += stepMs
  }
  return cond()
}

/** "600 ft · live" → 600 (feet); "0.4 mi" → 2112; NaN if no distance. */
export function feetIn(text: string): number {
  const ft = text.match(/(\d+(?:\.\d+)?)\s*ft/)
  if (ft) return parseFloat(ft[1])
  const mi = text.match(/(\d+(?:\.\d+)?)\s*mi/)
  if (mi) return parseFloat(mi[1]) * 5280
  return NaN
}

/** "last seen 23 s ago · 590 ft" → 23; NaN if absent. */
export function lastSeenSeconds(text: string): number {
  const m = text.match(/last seen (\d+) s ago/)
  return m ? parseInt(m[1]) : NaN
}

/**
 * Walks and turns the wearer from inside a scenario. In the Specs preview, Device
 * Tracking rewrites the camera's own transform every frame, so a scenario can't
 * move the camera directly. It can move a parent: this re-parents the camera
 * under a runtime rig and moves/turns the rig, which is what WASD walking and
 * mouse-look do to the tracked pose. The preview resets the scene between runs.
 */
export class WearerRig {
  private rig: SceneObject
  private yawDeg = 0

  constructor() {
    const cam = findSceneObjectByName("Camera Object")
    if (!cam) throw new Error('Scene object "Camera Object" not found')
    this.rig = global.scene.createSceneObject("LeafWearerRig")
    cam.setParent(this.rig)
  }

  get position(): vec3 {
    return this.rig.getTransform().getWorldPosition()
  }

  /** Walk in a straight line to a world position (cm) at a brisk walking pace. */
  async walkTo(target: vec3, speedCmPerS: number = 400): Promise<void> {
    const tr = this.rig.getTransform()
    const start = tr.getWorldPosition()
    const to = new vec3(target.x, start.y, target.z)
    const steps = Math.max(1, Math.ceil(start.distance(to) / speedCmPerS / 0.05))
    for (let i = 1; i <= steps; i++) {
      tr.setWorldPosition(vec3.lerp(start, to, i / steps))
      await sleep(50)
    }
  }

  /** Turn to an absolute heading in degrees (0 = north / world -Z, positive = clockwise / right). */
  async turnTo(yawDeg: number, durationMs: number = 800): Promise<void> {
    const tr = this.rig.getTransform()
    const from = this.yawDeg
    const steps = Math.max(1, Math.ceil(durationMs / 50))
    for (let i = 1; i <= steps; i++) {
      const y = from + ((yawDeg - from) * i) / steps
      tr.setWorldRotation(quat.angleAxis((-y * Math.PI) / 180, vec3.up()))
      await sleep(50)
    }
    this.yawDeg = yawDeg
  }
}

/**
 * Horizontal angle (deg) between where the wearer looks and the HUD panel. A SPECS
 * eye sees about ±17°, so a HUD message only counts as shown if this is small.
 */
export function hudAngleDeg(): number {
  const cam = findSceneObjectByName("Camera Object").getTransform()
  const hud = findSceneObjectByName("Hud").getTransform().getWorldPosition()
  const f = cam.back
  const d = hud.sub(cam.getWorldPosition())
  let deg = ((Math.atan2(d.x, -d.z) - Math.atan2(f.x, -f.z)) * 180) / Math.PI
  while (deg > 180) deg -= 360
  while (deg < -180) deg += 360
  return Math.abs(deg)
}

/** Make sure the wearer's session panel is open (it collapses to a pill after a few idle seconds). */
export async function openSessionPanel(ix: MyLocoLeafInteractor): Promise<void> {
  if (!lens.session().isExpanded) {
    await ix.tapButton("Button_MyLoco")
    await sleep(300)
  }
}
