/**
 * Done criterion 2: walking toward the beacon (or Skip closer) lowers the
 * distance. Below 75 m the beacon turns into a person-height marker with an
 * uncertainty ring on the ground. Below the Here threshold a ring appears
 * around the wearer with "Maya is within ~X ft. Look around."
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {MyLocoLeafInteractor, WearerRig, feetIn, hudAngleDeg, lens, waitFor} from "./MyLocoLeaf"

@component
export class DC2WalkCloserScenario extends Scenario {
  async run(): Promise<void> {
    const ix = new MyLocoLeafInteractor()
    const rig = new WearerRig()
    const c = lens.controller()
    expect(await waitFor(() => c.state === "live-far-live", 3000)).toBe(true)
    await sleep(1500)
    const ft0 = feetIn(lens.label().statusLine)

    // 1) Walk 15 m toward her: the distance on the chip drops.
    await rig.walkTo(new vec3(260, 0, -1480))
    await sleep(2500) // smoothing settles
    const ft1 = feetIn(lens.label().statusLine)
    print("[DC2] chip " + ft0 + " ft → after walking 15 m: " + ft1 + " ft")
    expect(ft0 - ft1).toBeGreaterThan(25)
    expect(c.band).toBe("far")

    // 2) Skip closer until she's inside 75 m: pillar → person marker + uncertainty ring.
    for (let i = 0; i < 4 && c.band === "far"; i++) {
      await ix.tapButton("Button_Skipcloser")
      await waitFor(() => c.band === "near", 3500)
    }
    expect(c.band).toBe("near")
    expect(await waitFor(() => lens.beacon().nearWeight > 0.9 && lens.beacon().farWeight < 0.1, 3000)).toBe(true)
    expect(lens.label().isVisible).toBe(true)
    print("[DC2] near band, chip: " + lens.label().statusLine)

    // 3) Walk up to where the marker stands until the Here band takes over.
    for (let i = 0; i < 3 && c.band !== "here"; i++) {
      const a = lens.beacon().labelAnchor // above the marker's feet
      const p = rig.position
      const dx = a.x - p.x
      const dz = a.z - p.z
      const d = Math.sqrt(dx * dx + dz * dz)
      const stop = Math.max(0, d - 300) // stop ~3 m short of the pin
      await rig.walkTo(new vec3(p.x + (dx / d) * stop, 0, p.z + (dz / d) * stop))
      await waitFor(() => c.band === "here", 4000)
    }
    expect(c.band).toBe("here")
    expect(await waitFor(() => lens.beacon().hereWeight > 0.9 && lens.beacon().nearWeight < 0.1, 3000)).toBe(true)
    expect(lens.label().isVisible).toBe(false)
    const head = lens.hud().headline
    print("[DC2] here band, HUD: " + head)
    expect(/^Maya is within ~\d+ ft\. Look around\.$/.test(head)).toBe(true)

    // The message has to be in view, not just set: turn 20° (as someone looking around
    // would) and the HUD must follow into the ~±17° view.
    await rig.turnTo(20, 600)
    await sleep(2000)
    const off = hudAngleDeg()
    print("[DC2] HUD " + off.toFixed(1) + "° from the view centre after a 20° turn")
    expect(10).toBeGreaterThan(off)
  }
}
