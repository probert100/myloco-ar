/**
 * SessionUI — the wearer's only controls, kept deliberately tiny (the "phone
 * test" cut everything else): Mute/Unmute and End. After a few seconds without
 * interaction it collapses to a small pill; pinch the pill to open it again.
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {NEAR_PANEL_CM, Panel, addButton, addColumnText, addRow, buildPanel, deferredVisibility} from "./UiKitHelpers"

@component
export class SessionUI extends BaseScriptComponent {
  @input
  @hint("Title shown on the panel.")
  title: string = "MyLoco AR · Meet Me There"

  @input
  @hint("Seconds without interaction before the panel collapses to a pill (0 = never).")
  collapseAfterS: number = 8

  @input("vec4", "{1.0,1.0,1.0,1.0}")
  @widget(new ColorWidget())
  @hint("Title colour.")
  titleColor: vec4

  @input("vec4", "{1.0,0.62,0.50,1.0}")
  @widget(new ColorWidget())
  @hint("Status colour.")
  statusColor: vec4

  private _onMuteChanged = new Event<boolean>()
  private _onEnd = new Event<void>()
  get onMuteChanged(): PublicApi<boolean> {
    return this._onMuteChanged.publicApi()
  }
  get onEnd(): PublicApi<void> {
    return this._onEnd.publicApi()
  }

  private panelSO: SceneObject
  private pillSO: SceneObject
  private status: Text
  private muteLabel: Text
  private muted = false
  private idle = 0
  private expanded = true
  private setPillShown: (v: boolean) => void

  onAwake(): void {
    const root = this.getSceneObject()
    this.panelSO = global.scene.createSceneObject("SessionPanel")
    this.panelSO.setParent(root)
    // Arm's-length panel: text sized for 75 cm, buttons >= 4 cm tall (brief: big pinch targets).
    const D = NEAR_PANEL_CM
    const p: Panel = buildPanel(this.panelSO, 19, 1.0, 0.6)
    addColumnText(p.content, this.title, "Subheadline", this.titleColor, 1.5, D)
    this.status = addColumnText(p.content, "Connecting…", "Caption", this.statusColor, 1.4, D).text
    const row = addRow(p.content, "Buttons", 1.0, 4.6)
    const mute = addButton(row.so, "Mute", 8.2, 4.4, () => this.toggleMute(), D)
    this.muteLabel = mute.label
    const end = addButton(row.so, "End", 8.2, 4.4, () => {
      this.touch()
      this._onEnd.invoke()
    }, D)
    // Aiming at the panel counts as using it: don't fold it away while the wearer is reaching for a button.
    mute.button.onHoverEnter.add(() => this.touch())
    end.button.onHoverEnter.add(() => this.touch())

    this.pillSO = global.scene.createSceneObject("SessionPill")
    this.pillSO.setParent(root)
    this.pillSO.createComponent("Component.Canvas")
    const pillRow = addRow(this.pillSO, "PillRow", 0, 4.4)
    addButton(pillRow.so, "MyLoco", 9, 4.2, () => this.expand(), D)
    // The pill starts hidden, but only after its UIKit button has initialised (see deferredVisibility).
    this.setPillShown = deferredVisibility(pillRow.flex, this.pillSO, false)

    this.createEvent("UpdateEvent").bind(() => {
      if (!this.expanded || this.collapseAfterS <= 0) return
      this.idle += getDeltaTime()
      if (this.idle > this.collapseAfterS) this.collapse()
    })
  }

  setStatus(text: string): void {
    if (this.status) this.status.text = text
  }

  get isMuted(): boolean {
    return this.muted
  }

  toggleMute(): void {
    this.touch()
    this.muted = !this.muted
    this.muteLabel.text = this.muted ? "Unmute" : "Mute"
    this._onMuteChanged.invoke(this.muted)
  }

  expand(): void {
    this.expanded = true
    this.idle = 0
    this.panelSO.enabled = true
    this.setPillShown(false)
  }

  collapse(): void {
    this.expanded = false
    this.panelSO.enabled = false
    this.setPillShown(true)
  }

  get isExpanded(): boolean {
    return this.expanded
  }

  /** Current status line. Read by the LEAF scenarios. */
  get statusText(): string {
    return this.status ? this.status.text : ""
  }

  private touch(): void {
    this.idle = 0
  }
}
