/**
 * PreviewSet — PREVIEW-ONLY set dressing so the demo video shows scale:
 * festival tents, a stage and ~900 crowd silhouettes, densest along the walk to
 * the friend and around the stage. Built as one procedural mesh; disabled on SPECS hardware
 * (the real crowd is the set there).
 */
import {MeshAccumulator} from "./Meshes"
import {makeRng} from "./GeoMath"

@component
export class PreviewSet extends BaseScriptComponent {
  @input
  @hint("Unlit material to clone for the set.")
  baseMaterial: Material

  @input
  @hint("Build the set on SPECS hardware too (normally editor-only).")
  showOnDevice: boolean = false

  @input
  @hint("Number of crowd silhouettes.")
  crowdCount: number = 900

  @input
  @hint("Ground height relative to the preview camera start (cm).")
  groundY: number = -160

  @input("vec4", "{0.55,0.62,0.75,0.8}")
  @widget(new ColorWidget())
  @hint("Crowd colour.")
  crowdColor: vec4

  @input("vec4", "{0.35,0.70,0.68,0.42}")
  @widget(new ColorWidget())
  @hint("Tent/stage colour.")
  tentColor: vec4

  onAwake(): void {
    if (!global.deviceInfoSystem.isEditor() && !this.showOnDevice) {
      this.getSceneObject().enabled = false
      return
    }
    if (isNull(this.baseMaterial)) return
    const rng = makeRng(42)
    const y = this.groundY
    // ENU metres → world cm: east → +x, north → -z
    const W = (e: number, n: number) => ({x: e * 100, z: -n * 100})

    // Crowd: dense along the corridor between the wearer (0,0) and where Maya starts (~32 E, 180 N),
    // thicker around the stage, thinner elsewhere, with a narrow lane left clear where the wearer walks.
    const crowd = new MeshAccumulator()
    const stage = {e: -20, n: 52}
    let placed = 0
    let guard = 0
    while (placed < this.crowdCount && guard++ < this.crowdCount * 6) {
      const pick = rng()
      let e: number
      let n: number
      if (pick < 0.62) {
        const t = 4 + rng() * 190 // along the corridor
        const lateral = (rng() - 0.5) * 2 * (14 + t * 0.12)
        e = (32 / 180) * t + lateral
        n = t
      } else if (pick < 0.85) {
        const r = 4 + Math.sqrt(rng()) * 22 // around the stage
        const a = rng() * Math.PI * 2
        e = stage.e + Math.sin(a) * r
        n = stage.n - 6 - Math.abs(Math.cos(a)) * r // in front of it (south side)
      } else {
        const r = 10 + Math.sqrt(rng()) * 150 // scattered
        const a = rng() * Math.PI * 2
        e = Math.sin(a) * r
        n = 20 + Math.cos(a) * r
      }
      if (Math.abs(e) < 1.6 && n > -2 && n < 40) continue // the wearer's walking lane
      if (e * e + n * n < 9) continue // nobody on top of the wearer
      const p = W(e, n)
      const h = 150 + rng() * 40
      crowd.cylinder(p.x, y, p.z, 22, h * 0.82, 6, false, 0.75)
      crowd.sphere(p.x, y + h * 0.9, p.z, 12, 6, 4)
      placed++
    }
    this.addMesh("Crowd", crowd, this.crowdColor)

    const tents = new MeshAccumulator()
    const tentSpots = [
      [-34, 66], [-40, 96], [-28, 136], [44, 76], [50, 118], [58, 160],
      [-52, 172], [22, 206], [-14, 214], [72, 42], [-66, 30], [16, 124],
    ]
    for (const [e, n] of tentSpots) {
      const p = W(e, n)
      tents.cylinder(p.x, y, p.z, 300, 220, 4, false)
      tents.pyramid(p.x, y + 220, p.z, 260, 180)
    }
    // Stage off to the left of the walk: a low platform and a thin backdrop wall facing the crowd.
    const s = W(stage.e, stage.n)
    tents.box(s.x, y + 60, s.z, 650, 60, 380)
    tents.box(s.x, y + 120 + 260, s.z - 380, 650, 260, 20)
    this.addMesh("TentsAndStage", tents, this.tentColor)
    print("[PreviewSet] crowd=" + placed + " people, crowd verts=" + crowd.count + ", tent verts=" + tents.count)

    // A label so nobody mistakes the set for the product.
    const signSO = global.scene.createSceneObject("PreviewSetSign")
    signSO.setParent(this.getSceneObject())
    // Off the walking lane, a little left, readable from the start position.
    signSO.getTransform().setWorldPosition(new vec3(-170, y + 235, -1000))
    signSO.getTransform().setWorldScale(new vec3(6, 6, 6))
    const t = signSO.createComponent("Component.Text") as Text
    t.text = "PREVIEW SET\nsimulated festival, not shown on SPECS"
    t.size = 40
    t.depthTest = true
    t.textFill.color = new vec4(1, 0.85, 0.35, 0.9)
    t.horizontalAlignment = HorizontalAlignment.Center
  }

  private addMesh(name: string, acc: MeshAccumulator, color: vec4): void {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.getSceneObject())
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = acc.build()
    const mat = this.baseMaterial.clone()
    mat.mainPass.blendMode = BlendMode.Normal
    mat.mainPass.twoSided = true
    // The set never occludes Lens content: on SPECS the crowd is real and the additive display draws the
    // beacon over it. The set is drawn first (it sits above BeaconView in the hierarchy) and writes no depth.
    mat.mainPass.depthWrite = false
    mat.mainPass.baseColor = color
    rmv.mainMaterial = mat
    // Draw the set before all Lens content so the beacon, chip and panels always paint over it.
    rmv.renderOrder = -100
  }
}
