/**
 * Meshes — procedural primitives for the beacon, rings, arrow and preview set.
 * Built with MeshBuilder so the Lens needs no imported model files. Every mesh
 * is unit-sized (scale it with the Transform) and drawn with two-sided
 * materials, so winding mistakes can't make faces disappear.
 */

type V3 = [number, number, number]

export class MeshAccumulator {
  verts: number[] = []
  indices: number[] = []
  count = 0

  vertex(p: V3, n: V3, u: number, v: number): number {
    this.verts.push(p[0], p[1], p[2], n[0], n[1], n[2], u, v)
    return this.count++
  }

  tri(a: number, b: number, c: number): void {
    this.indices.push(a, b, c)
  }

  quad(a: number, b: number, c: number, d: number): void {
    this.indices.push(a, b, c, a, c, d)
  }

  build(): RenderMesh {
    const mb = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3, normalized: true},
      {name: "texture0", components: 2},
    ])
    mb.topology = MeshTopology.Triangles
    mb.indexType = this.count > 65000 ? MeshIndexType.UInt32 : MeshIndexType.UInt16
    mb.appendVerticesInterleaved(this.verts)
    mb.appendIndices(this.indices)
    mb.updateMesh()
    return mb.getMesh()
  }

  /** Open-ended (or capped) cylinder, base centre at (cx,cy,cz), radius r, height h. */
  cylinder(cx: number, cy: number, cz: number, r: number, h: number, seg: number, cap: boolean, taper = 1): void {
    const base = this.count
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const x = Math.cos(a)
      const z = Math.sin(a)
      this.vertex([cx + x * r, cy, cz + z * r], [x, 0, z], i / seg, 0)
      this.vertex([cx + x * r * taper, cy + h, cz + z * r * taper], [x, 0, z], i / seg, 1)
    }
    for (let i = 0; i < seg; i++) {
      const b0 = base + i * 2
      this.quad(b0, b0 + 2, b0 + 3, b0 + 1)
    }
    if (cap) {
      const c = this.vertex([cx, cy + h, cz], [0, 1, 0], 0.5, 1)
      for (let i = 0; i < seg; i++) this.tri(c, base + i * 2 + 3, base + i * 2 + 1)
    }
  }

  /** Flat ring on the XZ plane at height y, inner/outer radius. */
  annulus(cx: number, y: number, cz: number, rIn: number, rOut: number, seg: number): void {
    const base = this.count
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2
      const x = Math.cos(a)
      const z = Math.sin(a)
      this.vertex([cx + x * rIn, y, cz + z * rIn], [0, 1, 0], i / seg, 0)
      this.vertex([cx + x * rOut, y, cz + z * rOut], [0, 1, 0], i / seg, 1)
    }
    for (let i = 0; i < seg; i++) {
      const b0 = base + i * 2
      this.quad(b0, b0 + 1, b0 + 3, b0 + 2)
    }
  }

  /** Low-poly UV sphere. */
  sphere(cx: number, cy: number, cz: number, r: number, seg: number, rings: number): void {
    const base = this.count
    for (let j = 0; j <= rings; j++) {
      const v = j / rings
      const phi = v * Math.PI
      for (let i = 0; i <= seg; i++) {
        const u = i / seg
        const th = u * Math.PI * 2
        const n: V3 = [Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)]
        this.vertex([cx + n[0] * r, cy + n[1] * r, cz + n[2] * r], n, u, v)
      }
    }
    const row = seg + 1
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < seg; i++) {
        const a = base + j * row + i
        this.quad(a, a + 1, a + row + 1, a + row)
      }
    }
  }

  /** Square-based pyramid (tent roof) or box-ish tent body. */
  pyramid(cx: number, cy: number, cz: number, half: number, h: number): void {
    const top = this.vertex([cx, cy + h, cz], [0, 1, 0], 0.5, 1)
    const c: V3[] = [
      [cx - half, cy, cz - half],
      [cx + half, cy, cz - half],
      [cx + half, cy, cz + half],
      [cx - half, cy, cz + half],
    ]
    const ids = c.map((p, i) => this.vertex(p, [0, 0.5, 0], i / 4, 0))
    for (let i = 0; i < 4; i++) this.tri(ids[i], ids[(i + 1) % 4], top)
  }

  /** Flat chevron "▲" pointing +Y, in the XY plane, unit height. */
  chevron(): void {
    const n: V3 = [0, 0, 1]
    const t = this.vertex([0, 0.5, 0], n, 0.5, 1)
    const l = this.vertex([-0.45, -0.5, 0], n, 0, 0)
    const m = this.vertex([0, -0.15, 0], n, 0.5, 0.3)
    const r = this.vertex([0.45, -0.5, 0], n, 1, 0)
    this.tri(t, l, m)
    this.tri(t, m, r)
  }
}

export function makeCylinderMesh(seg = 24, taper = 1): RenderMesh {
  const m = new MeshAccumulator()
  m.cylinder(0, 0, 0, 1, 1, seg, true, taper)
  return m.build()
}

export function makeRingMesh(innerRatio = 0.92, seg = 64): RenderMesh {
  const m = new MeshAccumulator()
  m.annulus(0, 0, 0, innerRatio, 1, seg)
  return m.build()
}

export function makeDiscMesh(seg = 48): RenderMesh {
  const m = new MeshAccumulator()
  m.annulus(0, 0, 0, 0, 1, seg)
  return m.build()
}

export function makeSphereMesh(): RenderMesh {
  const m = new MeshAccumulator()
  m.sphere(0, 0, 0, 1, 16, 10)
  return m.build()
}

export function makeChevronMesh(): RenderMesh {
  const m = new MeshAccumulator()
  m.chevron()
  return m.build()
}
