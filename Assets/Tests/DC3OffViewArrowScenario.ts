/**
 * Done criterion 3: turning away until the beacon is out of view shows the
 * edge arrow pointing toward it. Turning back hides the arrow.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {WearerRig, lens, waitFor} from "./MyLocoLeaf"

@component
export class DC3OffViewArrowScenario extends Scenario {
  async run(): Promise<void> {
    const rig = new WearerRig()
    expect(await waitFor(() => lens.controller().state === "live-far-live", 3000)).toBe(true)
    await sleep(1500)
    // Facing north, Maya is ~10° to the right: beacon in view, no arrow.
    expect(lens.beacon().inView).toBe(true)
    expect(lens.beacon().arrowWeight).toBeLessThan(0.05)

    // Turn 90° right (to face east). She is now ~80° to the left.
    await rig.turnTo(90)
    await sleep(1000)
    expect(lens.beacon().inView).toBe(false)
    expect(lens.beacon().arrowWeight).toBeGreaterThan(0.9)
    // The arrow sits at the left edge of the view, i.e. on the side she is on.
    const cam = findSceneObjectByName("Camera Object").getTransform()
    const arrowPos = findSceneObjectByName("OffViewArrow").getTransform().getWorldPosition()
    const side = arrowPos.sub(cam.getWorldPosition()).dot(cam.right)
    print("[DC3] facing east: arrow weight " + lens.beacon().arrowWeight.toFixed(2) + ", side " + side.toFixed(1) + " cm")
    expect(0).toBeGreaterThan(side)

    // Turn back to face north: the arrow goes away.
    await rig.turnTo(0)
    await sleep(1000)
    expect(lens.beacon().inView).toBe(true)
    expect(lens.beacon().arrowWeight).toBeLessThan(0.05)
    print("[DC3] facing north again: arrow weight " + lens.beacon().arrowWeight.toFixed(2))
  }
}
