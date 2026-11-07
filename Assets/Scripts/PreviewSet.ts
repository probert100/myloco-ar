/**
 * PreviewSet — PREVIEW-ONLY set dressing so the demo video shows scale:
 * festival tents, a stage and a few hundred crowd silhouettes laid out around
 * the preview origin. Built as one procedural mesh; disabled on SPECS hardware
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
  crowdCount: number = 320

  @input
  @hint("Ground height relative to the preview camera start (cm).")
  groundY: number = -160

  @input("vec4", "{0.55,0.62,0.75,0.55}")
  @widget(new ColorWidget())
  @hint("Crowd colour.")
  crowdColor: vec4

  @input("vec4", "{0.35,0.75,0.70,0.6}")
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

    const crowd = new MeshAccumulator()
    for (let i = 0; i < this.crowdCount; i++) {
      const r = 6 + Math.sqrt(rng()) * 190
      const a = rng() * Math.PI * 2
      const e = Math.sin(a) * r
      const n = Math.cos(a) * r * 0.9 + 25
      const p = W(e, n)
      const h = 150 + rng() * 40
      crowd.cylinder(p.x, y, p.z, 22, h * 0.82, 6, false, 0.75)
      crowd.sphere(p.x, y + h * 0.9, p.z, 12, 6, 4)
    }
    this.addMesh("Crowd", crowd, this.crowdColor)

    const tents = new MeshAccumulator()
    const tentSpots = [
      [-30, 60], [-38, 90], [-25, 130], [40, 75], [48, 115], [55, 160],
      [-50, 170], [20, 200], [-12, 210], [70, 40], [-65, 35], [14, 112],
    ]
    for (const [e, n] of tentSpots) {
      const p = W(e, n)
      tents.cylinder(p.x, y, p.z, 300, 220, 4, false)
      tents.pyramid(p.x, y + 220, p.z, 260, 180)
    }
    // Stage near the meeting point
    const s = W(0, 44)
    tents.cylinder(s.x, y, s.z, 900, 120, 4, true)
    tents.cylinder(s.x, y + 120, s.z - 500, 900, 600, 4, false, 1)
    this.addMesh("TentsAndStage", tents, this.tentColor)

    // A label so nobody mistakes the set for the product.
    const signSO = global.scene.createSceneObject("PreviewSetSign")
    signSO.setParent(this.getSceneObject())
    signSO.getTransform().setWorldPosition(new vec3(-120, y + 210, -600))
    signSO.getTransform().setWorldScale(new vec3(4, 4, 4))
    const t = signSO.createComponent("Component.Text") as Text
    t.text = "PREVIEW SET · simulated festival (not part of the Lens on SPECS)"
    t.size = 24
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
    mat.mainPass.twoSided = true
    mat.mainPass.baseColor = color
    rmv.mainMaterial = mat
  }
}
