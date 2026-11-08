/**
 * Done criterion 4: pressing Signal lost dims the beacon to its stale (hollow)
 * style and "last seen N s ago" counts up every second. Pressing Restore
 * returns it to live.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {MyLocoLeafInteractor, lastSeenSeconds, lens, waitFor} from "./MyLocoLeaf"

@component
export class DC4SignalLostScenario extends Scenario {
  async run(): Promise<void> {
    const ix = new MyLocoLeafInteractor()
    expect(await waitFor(() => lens.controller().state === "live-far-live", 3000)).toBe(true)
    expect(lens.beacon().coreVisible).toBe(true)

    // Friend's phone stops reporting.
    await ix.tapButton("Button_Signallost")
    expect(lens.feed().isSignalLost).toBe(true)

    // A fix older than 20 s is stale: hollow + dim + "last seen N s ago".
    expect(await waitFor(() => lens.controller().state === "live-far-stale", 26000, 250)).toBe(true)
    expect(await waitFor(() => lens.beacon().freshWeight < 0.7, 2000)).toBe(true)
    expect(lens.beacon().coreVisible).toBe(false)
    const status1 = lens.label().statusLine
    const n1 = lastSeenSeconds(status1)
    print("[DC4] stale chip: " + status1)
    expect(n1).toBeGreaterThan(19)

    // Counts up every second.
    await sleep(3000)
    const status2 = lens.label().statusLine
    const n2 = lastSeenSeconds(status2)
    print("[DC4] stale chip 3 s later: " + status2)
    expect(n2 - n1).toBeGreaterThan(1)
    expect(5).toBeGreaterThan(n2 - n1)

    // Restore: the next fix (≤ 2 s) brings it back to live.
    await ix.tapButton("Button_Signallost") // the same button now reads "Restore"
    expect(lens.feed().isSignalLost).toBe(false)
    expect(await waitFor(() => lens.controller().state === "live-far-live", 4000)).toBe(true)
    expect(await waitFor(() => lens.beacon().coreVisible, 2000)).toBe(true)
    expect(lens.label().statusLine.includes("live")).toBe(true)
  }
}
