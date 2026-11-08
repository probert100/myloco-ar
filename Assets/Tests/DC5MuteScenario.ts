/**
 * Done criterion 5b: pressing Mute toggles the chime. While muted, a band
 * change (Far → Near) is silent; after Unmute, the next cue plays again.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {MyLocoLeafInteractor, lens, openSessionPanel, waitFor} from "./MyLocoLeaf"

@component
export class DC5MuteScenario extends Scenario {
  async run(): Promise<void> {
    const ix = new MyLocoLeafInteractor()
    const c = lens.controller()
    expect(await waitFor(() => c.state === "live-far-live", 3000)).toBe(true)
    expect(c.isMuted).toBe(false)

    // Mute.
    await openSessionPanel(ix)
    await ix.tapButton("Button_Mute")
    expect(c.isMuted).toBe(true)

    // Bring the friend into the Near band: that cue must be swallowed.
    const played0 = c.chimesPlayed
    const muted0 = c.chimesMuted
    for (let i = 0; i < 3 && c.band !== "near"; i++) {
      await ix.tapButton("Button_Skipcloser")
      await waitFor(() => c.band === "near", 4000)
    }
    expect(c.band).toBe("near")
    await sleep(300)
    expect(c.chimesPlayed - played0).toBe(0)
    expect(c.chimesMuted - muted0).toBe(1)

    // Unmute: the next cue (share ended) plays.
    await openSessionPanel(ix)
    await ix.tapButton("Button_Mute") // now reads "Unmute"
    expect(c.isMuted).toBe(false)
    await ix.tapButton("Button_Endshare")
    expect(await waitFor(() => c.chimesPlayed - played0 === 1, 1000)).toBe(true)
  }
}
