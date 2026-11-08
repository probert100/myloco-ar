/**
 * FriendTracker — turns raw, jumpy 2-second GPS fixes into something calm
 * enough to draw: smoothed position, distance band (with hysteresis),
 * freshness, and combined uncertainty. Pure logic, no scene access.
 */
import {Enu, GeoFix, combinedAccuracy, enuBearingDeg, enuLength, enuOffset} from "./GeoMath"

export type Band = "far" | "near" | "here"
export type Freshness = "live" | "stale" | "old"

export interface TrackerConfig {
  /** Beyond this the friend is a tall beacon (m). */
  nearM: number
  /** Minimum "you're here" radius (m); grows with GPS uncertainty. */
  hereMinM: number
  /** Fractional hysteresis on every band edge. */
  hysteresis: number
  /** A fix older than this is "stale" (s). */
  staleAfterS: number
  /** A fix older than this is "old" (s). */
  oldAfterS: number
  /** Spring stiffness for position smoothing (rad/s). */
  smoothingOmega: number
  /** Max seconds of dead reckoning beyond the last fix. */
  maxDeadReckonS: number
}

export const DEFAULT_TRACKER_CONFIG: TrackerConfig = {
  nearM: 75,
  hereMinM: 15,
  hysteresis: 0.15,
  staleAfterS: 20,
  oldAfterS: 300,
  smoothingOmega: 1.6,
  maxDeadReckonS: 4,
}

export interface TrackState {
  valid: boolean
  distanceM: number
  bearingDeg: number
  band: Band
  bandChanged: boolean
  combinedAccuracyM: number
  hereRadiusM: number
  ageS: number
  freshness: Freshness
}

export class FriendTracker {
  cfg: TrackerConfig
  private ref: {lat: number; lng: number} | null = null
  private pos: Enu = {east: 0, north: 0}
  private vel: Enu = {east: 0, north: 0}
  private band: Band | null = null
  private fix: GeoFix | null = null
  /** Filtered estimate of the friend's position at the last fix (ENU m from ref). */
  private est: Enu | null = null
  /** Velocity estimated from successive filtered fixes (m/s), used when the phone reports none. */
  private estVel: Enu = {east: 0, north: 0}

  constructor(cfg: TrackerConfig = DEFAULT_TRACKER_CONFIG) {
    this.cfg = cfg
  }

  reset(): void {
    this.ref = null
    this.band = null
    this.fix = null
    this.vel = {east: 0, north: 0}
    this.est = null
    this.estVel = {east: 0, north: 0}
  }

  /**
   * Call when a new fix arrives. Each fix is blended with a prediction from the
   * previous estimate (alpha filter): a phone fix in a crowd is often 5-10 m
   * off, so averaging across fixes keeps the distance honest without lagging a
   * walker, because the prediction already carries her reported speed and
   * heading. A jump far outside the accuracy (a real jump, or a "Skip closer")
   * is taken as-is.
   */
  onFix(fix: GeoFix): void {
    const prev = this.fix
    this.fix = fix
    if (this.ref === null) {
      this.ref = {lat: fix.lat, lng: fix.lng}
      this.pos = {east: 0, north: 0}
      this.vel = {east: 0, north: 0}
    }
    const meas = enuOffset(this.ref.lat, this.ref.lng, fix.lat, fix.lng)
    if (this.est === null || prev === null) {
      this.est = meas
      return
    }
    const dtFix = Math.max(0.1, (fix.timestampMs - prev.timestampMs) / 1000)
    // Phone says how it's moving (a stop reads as speed 0): trust that. Otherwise use our own estimate.
    const v = fix.speedMps !== null ? reportedVelocity(fix) || {east: 0, north: 0} : this.estVel
    const pred: Enu = {east: this.est.east + v.east * dtFix, north: this.est.north + v.north * dtFix}
    const rE = meas.east - pred.east
    const rN = meas.north - pred.north
    const jump = Math.sqrt(rE * rE + rN * rN) > Math.max(25, 3 * fix.accuracyM)
    const alpha = jump ? 1 : clamp(8 / (8 + fix.accuracyM), 0.2, 0.8)
    const next: Enu = {east: pred.east + alpha * rE, north: pred.north + alpha * rN}
    if (!jump) {
      this.estVel = {
        east: 0.7 * this.estVel.east + 0.3 * ((next.east - this.est.east) / dtFix),
        north: 0.7 * this.estVel.north + 0.3 * ((next.north - this.est.north) / dtFix),
      }
    }
    this.est = next
  }

  /** Smoothed friend position relative to the wearer, plus band/freshness. */
  update(dt: number, nowMs: number, wearerLat: number, wearerLng: number, wearerAccM: number): TrackState {
    if (this.fix === null || this.ref === null) {
      return {
        valid: false, distanceM: 0, bearingDeg: 0, band: "far", bandChanged: false,
        combinedAccuracyM: 0, hereRadiusM: this.cfg.hereMinM, ageS: 0, freshness: "live",
      }
    }
    const fix = this.fix
    const ageS = Math.max(0, (nowMs - fix.timestampMs) / 1000)
    const freshness: Freshness = ageS > this.cfg.oldAfterS ? "old" : ageS > this.cfg.staleAfterS ? "stale" : "live"

    // Target = filtered fix, pushed forward along her motion while fresh (dead reckoning).
    const base = this.est !== null ? this.est : enuOffset(this.ref.lat, this.ref.lng, fix.lat, fix.lng)
    const target: Enu = {east: base.east, north: base.north}
    const v = reportedVelocity(fix)
    if (freshness === "live" && v !== null) {
      const t = Math.min(ageS, this.cfg.maxDeadReckonS)
      target.east += v.east * t
      target.north += v.north * t
    }

    // Critically damped spring toward the target (no overshoot, no jumps).
    const w = this.cfg.smoothingOmega
    const step = Math.min(dt, 0.1)
    this.vel.east += (w * w * (target.east - this.pos.east) - 2 * w * this.vel.east) * step
    this.vel.north += (w * w * (target.north - this.pos.north) - 2 * w * this.vel.north) * step
    this.pos.east += this.vel.east * step
    this.pos.north += this.vel.north * step

    // Relative to wearer.
    const refFromWearer = enuOffset(wearerLat, wearerLng, this.ref.lat, this.ref.lng)
    const rel: Enu = {east: refFromWearer.east + this.pos.east, north: refFromWearer.north + this.pos.north}
    const distanceM = enuLength(rel)
    const bearingDeg = enuBearingDeg(rel)

    const comb = combinedAccuracy(wearerAccM, fix.accuracyM)
    const hereRadiusM = Math.max(this.cfg.hereMinM, comb)
    const prev = this.band
    const band = this.nextBand(prev, distanceM, hereRadiusM)
    this.band = band

    return {
      valid: true, distanceM, bearingDeg, band, bandChanged: prev !== null && prev !== band,
      combinedAccuracyM: comb, hereRadiusM, ageS, freshness,
    }
  }

  private nextBand(prev: Band | null, d: number, here: number): Band {
    const h = this.cfg.hysteresis
    const near = this.cfg.nearM
    if (prev === null) return d < here ? "here" : d < near ? "near" : "far"
    switch (prev) {
      case "far":
        if (d < here * (1 - h)) return "here"
        return d < near * (1 - h) ? "near" : "far"
      case "near":
        if (d > near * (1 + h)) return "far"
        return d < here * (1 - h) ? "here" : "near"
      case "here":
        if (d > near * (1 + h)) return "far"
        return d > here * (1 + h) ? "near" : "here"
    }
    return prev
  }
}

/** The phone's own speed + heading as an ENU velocity (m/s), or null if it isn't moving / didn't say. */
function reportedVelocity(fix: GeoFix): Enu | null {
  if (fix.speedMps === null || fix.headingDeg === null || fix.speedMps <= 0.3) return null
  const h = (fix.headingDeg * Math.PI) / 180
  return {east: Math.sin(h) * fix.speedMps, north: Math.cos(h) * fix.speedMps}
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}
