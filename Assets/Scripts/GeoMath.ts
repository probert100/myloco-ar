/**
 * GeoMath — small, dependency-free geo helpers for MyLoco AR.
 *
 * Conventions
 * - Bearings/headings are compass degrees: 0 = north, 90 = east, clockwise.
 * - Local ENU offsets are metres (east, north).
 * - Lens Studio world: right-handed, +X right, +Y up, -Z forward, centimetres.
 *   "World yaw" of a direction d is atan2(d.x, -d.z) in degrees, so 0 = -Z, 90 = +X.
 */

export const EARTH_RADIUS_M = 6378137
const DEG = Math.PI / 180

/** One location sample, from either side (wearer or friend). */
export interface GeoFix {
  lat: number
  lng: number
  /** 1-sigma horizontal accuracy in metres. */
  accuracyM: number
  /** Direction of travel (compass deg) or null if unknown. */
  headingDeg: number | null
  /** Ground speed in m/s or null if unknown. */
  speedMps: number | null
  /** When the fix was taken (ms since epoch). */
  timestampMs: number
}

export interface Enu {
  east: number
  north: number
}

/** Metres east/north of `to` relative to `from` (equirectangular; accurate to <0.1% under a few km). */
export function enuOffset(fromLat: number, fromLng: number, toLat: number, toLng: number): Enu {
  const latMid = ((fromLat + toLat) / 2) * DEG
  return {
    east: (toLng - fromLng) * DEG * EARTH_RADIUS_M * Math.cos(latMid),
    north: (toLat - fromLat) * DEG * EARTH_RADIUS_M,
  }
}

/** Inverse of enuOffset: move a lat/lng by east/north metres. */
export function offsetLatLng(lat: number, lng: number, east: number, north: number): {lat: number; lng: number} {
  const dLat = north / EARTH_RADIUS_M / DEG
  const dLng = east / (EARTH_RADIUS_M * Math.cos(lat * DEG)) / DEG
  return {lat: lat + dLat, lng: lng + dLng}
}

export function enuLength(v: Enu): number {
  return Math.sqrt(v.east * v.east + v.north * v.north)
}

/** Compass bearing of an ENU vector (deg, 0..360). */
export function enuBearingDeg(v: Enu): number {
  return wrap360(Math.atan2(v.east, v.north) / DEG)
}

/**
 * Two independent GPS errors add in quadrature. Both people's error matters:
 * a 6 m wearer fix and a 12 m friend fix give ~13 m of real uncertainty.
 */
export function combinedAccuracy(a: number, b: number): number {
  return Math.sqrt(a * a + b * b)
}

export function wrap360(d: number): number {
  const r = d % 360
  return r < 0 ? r + 360 : r
}

/** Signed smallest difference a - b in degrees, in (-180, 180]. */
export function angleDiffDeg(a: number, b: number): number {
  let d = wrap360(a) - wrap360(b)
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

/** World yaw (deg) of a world-space direction vector. 0 = -Z, 90 = +X. */
export function worldYawDeg(dx: number, dz: number): number {
  return Math.atan2(dx, -dz) / DEG
}

/** Unit world direction (x, z) for a world yaw in degrees. */
export function dirFromWorldYaw(yawDeg: number): {x: number; z: number} {
  const r = yawDeg * DEG
  return {x: Math.sin(r), z: -Math.cos(r)}
}

/** "590 ft", "0.4 mi", "45 m", "1.2 km". */
export function formatDistance(metres: number, metric: boolean): string {
  if (metric) {
    if (metres >= 1000) return (metres / 1000).toFixed(1) + " km"
    return Math.round(metres / 5) * 5 + " m"
  }
  const feet = metres * 3.28084
  if (feet >= 1000) return (feet / 5280).toFixed(1) + " mi"
  const step = feet > 200 ? 10 : 5
  return Math.round(feet / step) * step + " ft"
}

/** "12 s", "3 min", "1 h". */
export function formatAge(seconds: number): string {
  if (seconds < 60) return Math.max(0, Math.floor(seconds)) + " s"
  if (seconds < 3600) return Math.floor(seconds / 60) + " min"
  return Math.floor(seconds / 3600) + " h"
}

/** Walking ETA at an average 1.3 m/s, e.g. "~3 min walk". */
export function formatWalk(metres: number): string {
  const minutes = metres / 1.3 / 60
  if (minutes < 1) return "<1 min walk"
  return "~" + Math.round(minutes) + " min walk"
}

/** Box–Muller gaussian with a seeded PRNG supplied by the caller. */
export function gaussian(rand: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

/** Tiny deterministic PRNG (mulberry32) so the preview demo is repeatable. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
