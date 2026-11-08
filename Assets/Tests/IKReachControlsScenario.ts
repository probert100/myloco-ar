/**
 * Reachability check for the wearer controls (brief: "Every control is within
 * reach of someone standing there"). A simulated arm + head (LEAF IK) reaches
 * for the buttons the way a person would. LEAF records a diagnostic when a
 * target is out of reach, behind, out of view or occluded; this scenario fails
 * on any error-level diagnostic instead of letting the scripted fallback hide it.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {DiagnosticRecorder} from "Leaf.lspkg/Diagnostic/DiagnosticRecorder"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {lens, waitFor} from "./MyLocoLeaf"

@component
export class IKReachControlsScenario extends Scenario {
  private readonly ik = createIKInteractor()

  async run(): Promise<void> {
    await this.ik.ready
    const c = lens.controller()
    expect(await waitFor(() => c.state === "live-far-live", 3000)).toBe(true)
    const recorder = DiagnosticRecorder.getInstance()
    const before = recorder.getAll().length

    // Left hand: Mute on the wearer's session panel (left of centre), while it's open.
    const mute = findInteractableByName("Button_Mute", undefined, true)
    expect(mute !== undefined).toBe(true)
    await this.ik.trigger(mute, "left")
    await sleep(800)
    expect(c.isMuted).toBe(true)

    // Right hand: "Skip closer" on the preview-controls panel (right of centre).
    const skip = findInteractableByName("Button_Skipcloser", undefined, true)
    expect(skip !== undefined).toBe(true)
    const ft0 = lens.feed().simDistanceFromOrigin
    await this.ik.trigger(skip, "right")
    await sleep(800)
    expect(ft0 - lens.feed().simDistanceFromOrigin).toBeGreaterThan(30)

    // Left hand again, after the panel has had time to fold away: the pill brings it back.
    await waitFor(() => !lens.session().isExpanded, 12000)
    await this.ik.trigger(findInteractableByName("Button_MyLoco", undefined, true), "left")
    await sleep(800)
    expect(lens.session().isExpanded).toBe(true)

    const found = recorder.getAll().slice(before)
    for (const e of found) print("[IK] " + e.diagnostic.severity + ": " + e.diagnostic.message)
    print("[IK] diagnostics: " + found.length)
    expect(found.filter((e) => e.diagnostic.severity === "error").length).toBe(0)
  }
}
