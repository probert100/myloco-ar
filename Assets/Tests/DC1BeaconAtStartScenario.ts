/**
 * Done criterion 1: at start, a coral beacon stands in the friend's direction
 * about 600 ft away, its chip reads "Maya · 600 ft · live", and it updates as
 * she walks.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {feetIn, lens, waitFor} from "./MyLocoLeaf"

@component
export class DC1BeaconAtStartScenario extends Scenario {
  async run(): Promise<void> {
    // First simulated fix arrives ~0.4 s after start; the pillar fades in over ~1.5 s.
    expect(await waitFor(() => lens.controller().state === "live-far-live", 3000)).toBe(true)
    expect(await waitFor(() => lens.beacon().farWeight > 0.9, 3000)).toBe(true)

    // Pillar only: no person marker, no ring around the wearer, solid (live) core.
    expect(lens.beacon().nearWeight).toBeCloseTo(0, 1)
    expect(lens.beacon().hereWeight).toBeCloseTo(0, 1)
    expect(lens.beacon().coreVisible).toBe(true)

    // Chip: "Maya" / "<~600> ft · live"
    const label = lens.label()
    expect(label.isVisible).toBe(true)
    expect(label.nameLine).toBe("Maya")
    expect(label.statusLine.includes("ft · live")).toBe(true)
    const startFt = feetIn(label.statusLine)
    print("[DC1] start chip: " + label.nameLine + " · " + label.statusLine)
    expect(startFt).toBeGreaterThan(540)
    expect(660).toBeGreaterThan(startFt)

    // She starts walking toward the stage after a 2 s pause. Watch the chip for ~10 s
    // (5 fixes): it must refresh, and the distance must come down as she walks.
    const seen: string[] = [label.statusLine]
    for (let i = 0; i < 10; i++) {
      await sleep(1000)
      if (seen[seen.length - 1] !== label.statusLine) seen.push(label.statusLine)
    }
    const laterFt = feetIn(label.statusLine)
    print("[DC1] chip over 10 s: " + seen.join(" → "))
    expect(seen.length).toBeGreaterThan(1)
    expect(startFt - laterFt).toBeGreaterThan(10)
    expect(label.statusLine.includes("live")).toBe(true)
  }
}
