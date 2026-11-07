/**
 * PreviewControlsUI — stand-ins for moments Lens Studio's preview can't
 * produce on its own (clearly labelled, editor-only):
 *   Signal lost / Restore  – the friend's phone stops/starts reporting
 *   Skip closer            – move the simulated friend 40 m along their walk
 *   End share              – the friend taps "Stop sharing" in MyLoco
 *   Restart                – replay the demo from the top
 */
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {Panel, addButton, addColumnText, addRow, buildPanel} from "./UiKitHelpers"

@component
export class PreviewControlsUI extends BaseScriptComponent {
  @input
  @hint("Show these controls on SPECS hardware too (normally editor-only).")
  showOnDevice: boolean = false

  @input("vec4", "{1.0,0.85,0.35,1.0}")
  @widget(new ColorWidget())
  @hint("Header colour (yellow = 'this is a preview stand-in').")
  headerColor: vec4

  private _onSignal = new Event<boolean>()
  private _onSkip = new Event<void>()
  private _onEndShare = new Event<void>()
  private _onRestart = new Event<void>()
  get onSignalLost(): PublicApi<boolean> { return this._onSignal.publicApi() }
  get onSkipCloser(): PublicApi<void> { return this._onSkip.publicApi() }
  get onEndShare(): PublicApi<void> { return this._onEndShare.publicApi() }
  get onRestart(): PublicApi<void> { return this._onRestart.publicApi() }

  private lost = false
  private signalLabel: Text

  onAwake(): void {
    if (!global.deviceInfoSystem.isEditor() && !this.showOnDevice) {
      this.getSceneObject().enabled = false
      return
    }
    const p: Panel = buildPanel(this.getSceneObject(), 22, 1.2, 0.7)
    addColumnText(p.content, "PREVIEW CONTROLS", "Caption", this.headerColor, 1.6)
    const r1 = addRow(p.content, "Row1", 1.0, 3.2)
    this.signalLabel = addButton(r1.so, "Signal lost", 10, 2.8, () => {
      this.lost = !this.lost
      this.signalLabel.text = this.lost ? "Restore" : "Signal lost"
      this._onSignal.invoke(this.lost)
    }).label
    addButton(r1.so, "Skip closer", 10, 2.8, () => this._onSkip.invoke())
    const r2 = addRow(p.content, "Row2", 1.0, 3.2)
    addButton(r2.so, "End share", 10, 2.8, () => this._onEndShare.invoke())
    addButton(r2.so, "Restart", 10, 2.8, () => {
      this.lost = false
      this.signalLabel.text = "Signal lost"
      this._onRestart.invoke()
    })
  }
}
