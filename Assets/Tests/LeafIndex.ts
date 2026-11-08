/**
 * LEAF scenario registry for MyLoco AR. One scenario per done criterion in
 * devpost/design-brief.md (criterion 5 is split into End share and Mute), plus
 * an IK reachability check for the wearer controls.
 */
import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {DC1BeaconAtStartScenario} from "./DC1BeaconAtStartScenario"
import {DC2WalkCloserScenario} from "./DC2WalkCloserScenario"
import {DC3OffViewArrowScenario} from "./DC3OffViewArrowScenario"
import {DC4SignalLostScenario} from "./DC4SignalLostScenario"
import {DC5EndShareScenario} from "./DC5EndShareScenario"
import {DC5MuteScenario} from "./DC5MuteScenario"
import {IKReachControlsScenario} from "./IKReachControlsScenario"
import {VideoTourScenario} from "./VideoTourScenario"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "dc1-beacon-at-start", typename: DC1BeaconAtStartScenario.getTypeName()},
    {id: "dc2-walk-closer-bands", typename: DC2WalkCloserScenario.getTypeName()},
    {id: "dc3-off-view-arrow", typename: DC3OffViewArrowScenario.getTypeName()},
    {id: "dc4-signal-lost-restore", typename: DC4SignalLostScenario.getTypeName()},
    {id: "dc5a-end-share", typename: DC5EndShareScenario.getTypeName()},
    {id: "dc5b-mute-toggles-chime", typename: DC5MuteScenario.getTypeName()},
    {id: "ik-reach-wearer-controls", typename: IKReachControlsScenario.getTypeName()},
    // Camera moves and pinches for the submission video (devpost/submission.md); not a done criterion.
    {id: "video-tour", typename: VideoTourScenario.getTypeName()},
  ]
}
