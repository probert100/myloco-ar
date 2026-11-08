/**
 * BeaconLabelUI — the small name chip that floats with the beacon:
 *   "Maya" / "590 ft · live"  or  "Maya" / "last seen 40 s ago".
 * It's world-anchored at the beacon and scaled with distance so it reads at
 * the same apparent size as a panel at arm's length.
 */
import {Panel, addColumnText, buildPanel, faceCamera} from "./UiKitHelpers"

@component
export class BeaconLabelUI extends BaseScriptComponent {
  @input("vec4", "{1.0,1.0,1.0,1.0}")
  @widget(new ColorWidget())
  @hint("Name colour.")
  nameColor: vec4

  @input("vec4", "{1.0,0.62,0.50,1.0}")
  @widget(new ColorWidget())
  @hint("Status line colour (live).")
  liveColor: vec4

  @input("vec4", "{0.75,0.75,0.75,1.0}")
  @widget(new ColorWidget())
  @hint("Status line colour (stale).")
  staleColor: vec4

  private panel: Panel
  private nameText: Text
  private statusText: Text
  private tr: Transform
  private visible = true

  onAwake(): void {
    this.panel = buildPanel(this.getSceneObject(), 16, 0.9, 0.3)
    this.nameText = addColumnText(this.panel.content, "", "Headline2", this.nameColor, 2.2).text
    this.statusText = addColumnText(this.panel.content, "", "Subheadline", this.liveColor, 2.0).text
    this.tr = this.getTransform()
  }

  setLines(name: string, status: string, live: boolean): void {
    if (!this.nameText) return
    this.nameText.text = name
    this.statusText.text = status
    this.statusText.textFill.color = live ? this.liveColor : this.staleColor
  }

  setPose(worldPos: vec3, scale: number, camPos: vec3): void {
    if (!this.tr) return
    this.tr.setWorldPosition(worldPos)
    this.tr.setWorldScale(new vec3(scale, scale, scale))
    faceCamera(this.tr, camPos)
  }

  /** Current chip lines and visibility. Read by the LEAF scenarios. */
  get nameLine(): string { return this.nameText ? this.nameText.text : "" }
  get statusLine(): string { return this.statusText ? this.statusText.text : "" }
  get isVisible(): boolean { return this.visible }

  setVisible(v: boolean): void {
    if (v === this.visible) return
    this.visible = v
    this.getSceneObject().enabled = v
  }
}
