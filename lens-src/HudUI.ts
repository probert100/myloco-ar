/**
 * HudUI — one short line of guidance, only when it earns a glance:
 *   "Waiting for Maya's location…", "Maya is within ~45 ft. Look around.",
 *   "Maya stopped sharing". Hidden the rest of the time.
 * Sits a little below the line of sight (placed by LazyFollow).
 */
import {Panel, addColumnText, buildPanel} from "./UiKitHelpers"

@component
export class HudUI extends BaseScriptComponent {
  @input("vec4", "{1.0,1.0,1.0,1.0}")
  @widget(new ColorWidget())
  @hint("Headline colour.")
  headColor: vec4

  @input("vec4", "{1.0,0.62,0.50,1.0}")
  @widget(new ColorWidget())
  @hint("Detail colour.")
  detailColor: vec4

  private panel: Panel
  private head: Text
  private detail: Text
  private current = ""

  onAwake(): void {
    this.panel = buildPanel(this.getSceneObject(), 30, 1.2, 0.4)
    this.head = addColumnText(this.panel.content, "", "Headline2", this.headColor, 2.4).text
    this.detail = addColumnText(this.panel.content, "", "Body", this.detailColor, 1.8).text
    this.getSceneObject().enabled = false
  }

  /** Pass null to hide. */
  show(headline: string | null, detail: string = ""): void {
    const key = headline === null ? "" : headline + "|" + detail
    if (key === this.current) return
    this.current = key
    if (!this.head) return
    if (headline === null) {
      this.getSceneObject().enabled = false
      return
    }
    this.head.text = headline
    this.detail.text = detail
    this.getSceneObject().enabled = true
  }
}
