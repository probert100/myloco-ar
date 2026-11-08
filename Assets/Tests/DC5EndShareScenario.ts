/**
 * Done criterion 5a: pressing End share fades the beacon and shows
 * "Maya stopped sharing" (with a chime, since audio cues are on by default).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {MyLocoLeafInteractor, WearerRig, hudAngleDeg, lens, waitFor} from "./MyLocoLeaf"

@component
export class DC5EndShareScenario extends Scenario {
  async run(): Promise<void> {
    const ix = new MyLocoLeafInteractor()
    const rig = new WearerRig()
    expect(await waitFor(() => lens.beacon().farWeight > 0.9, 4000)).toBe(true)
    const chimesBefore = lens.controller().chimesPlayed

    await ix.tapButton("Button_Endshare")

    expect(await waitFor(() => lens.controller().state === "ended", 1000)).toBe(true)
    expect(lens.hud().headline).toBe("Maya stopped sharing")
    expect(lens.label().isVisible).toBe(false)
    expect(lens.controller().chimesPlayed - chimesBefore).toBe(1)
    // Fades out over ~2 s.
    expect(await waitFor(() => lens.beacon().farWeight < 0.05, 3000)).toBe(true)
    expect(lens.beacon().nearWeight).toBeCloseTo(0, 1)
    expect(lens.beacon().hereWeight).toBeCloseTo(0, 1)

    // "Maya stopped sharing" must be in view: turn 20° and the HUD follows.
    await rig.turnTo(-20, 600)
    await sleep(2000)
    const off = hudAngleDeg()
    print("[DC5a] HUD " + off.toFixed(1) + "° from the view centre after a 20° turn")
    expect(10).toBeGreaterThan(off)
  }
}
