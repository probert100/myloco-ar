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

  constructor(cfg: TrackerConfig = DEFAULT_TRACKER_CONFIG) {
    this.cfg = cfg
  }

  reset(): void {
    this.ref = null
    this.band = null
    this.fix = null
    this.vel = {east: 0, north: 0}
  }

  /** Call when a new fix arrives. */
  onFix(fix: GeoFix): void {
    this.fix = fix
    if (this.ref === null) {
      this.ref = {lat: fix.lat, lng: fix.lng}
      this.pos = {east: 0, north: 0}
      this.vel = {east: 0, north: 0}
    }
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

    // Target = last fix, pushed forward along its reported motion while fresh.
    const target = enuOffset(this.ref.lat, this.ref.lng, fix.lat, fix.lng)
    if (freshness === "live" && fix.speedMps !== null && fix.headingDeg !== null && fix.speedMps > 0.3) {
      const t = Math.min(ageS, this.cfg.maxDeadReckonS)
      const h = (fix.headingDeg * Math.PI) / 180
      target.east += Math.sin(h) * fix.speedMps * t
      target.north += Math.cos(h) * fix.speedMps * t
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
