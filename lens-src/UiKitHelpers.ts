/**
 * UiKitHelpers — shared SpectaclesUIKit composition helpers (type scale, panel
 * skeleton, row text, width-budgeted buttons), following the CLAD
 * specs-build-ui patterns. Used by every *UI.ts module in this Lens.
 */
import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"

// ── Type scale — single source of truth (CLAD specs-build-ui → Typography)
const FONT_SIZE_SCALE = 1.0
export type TextRole =
  | "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2"
  | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, {size: number; weight: number}> = {
  Title1: {size: 105, weight: 700}, Title2: {size: 93, weight: 700},
  HeadlineXL: {size: 62, weight: 700}, Headline1: {size: 54, weight: 700},
  Headline2: {size: 48, weight: 700}, Subheadline: {size: 41, weight: 700},
  Button: {size: 39, weight: 500}, Callout: {size: 39, weight: 700},
  Body: {size: 39, weight: 500}, Caption: {size: 38, weight: 500},
}
export function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}
export function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & {weight?: number}).weight = TYPE_SCALE[role].weight
}

export const CONTENT_Z = 0.6
const BUTTON_LABEL_Z = 0.08

export interface Panel {
  root: SceneObject
  content: SceneObject
  flex: FlexLayout
  plate: BackPlate
}

/** Canvas → BackPlate → Content(+0.6 z) → FlexLayout column, plate hugs content. */
export function buildPanel(root: SceneObject, widthCm: number, pad: number, gap: number): Panel {
  root.createComponent("Component.Canvas")
  const plate = root.createComponent(BackPlate.getTypeName()) as BackPlate
  plate.style = "dark"
  const content = global.scene.createSceneObject("Content")
  content.setParent(root)
  content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
  const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
  flex.width = widthCm
  flex.height = -1
  flex.direction = FlexDirection.Column
  flex.alignItems = FlexAlign.Stretch
  flex.rowGap = gap
  flex.paddingTop = pad
  flex.paddingBottom = pad
  flex.paddingLeft = pad
  flex.paddingRight = pad
  flex.onLayoutComplete.add((r) => {
    plate.size = new vec2(r.containerWidth, r.containerHeight)
  })
  return {root, content, flex, plate}
}

/** A full-width text line in a column (Stretch trick from patterns.md). */
export function addColumnText(parent: SceneObject, text: string, role: TextRole, color: vec4, heightCm: number): {text: Text; item: FlexItem} {
  const so = global.scene.createSceneObject("Text")
  so.setParent(parent)
  const t = so.createComponent("Component.Text") as Text
  t.text = text
  t.depthTest = true
  applyTextRole(t, role)
  t.textFill.color = color
  t.horizontalAlignment = HorizontalAlignment.Center
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = HorizontalOverflow.Overflow
  t.verticalOverflow = VerticalOverflow.Overflow
  t.layoutRect = Rect.create(-0.5, 0.5, -heightCm / 2, heightCm / 2)
  const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
  item.alignSelf = FlexAlignSelf.Stretch
  return {text: t, item}
}

export function addRow(parent: SceneObject, name: string, gap: number, heightCm: number): {so: SceneObject; flex: FlexLayout; item: FlexItem} {
  const row = global.scene.createSceneObject(name)
  row.setParent(parent)
  const f = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
  f.direction = FlexDirection.Row
  f.justifyContent = FlexJustify.Center
  f.alignItems = FlexAlign.Center
  f.columnGap = gap
  f.width = -1
  f.height = heightCm
  const item = row.createComponent(FlexItem.getTypeName()) as FlexItem
  return {so: row, flex: f, item}
}

/** Width-budgeted UIKit Button with a raw Text label (patterns.md → Button with text). */
export function addButton(parent: SceneObject, label: string, sizeX: number, sizeY: number, onClick: () => void): {button: Button; label: Text; item: FlexItem} {
  const so = global.scene.createSceneObject("Button_" + label.replace(/[^A-Za-z]/g, ""))
  so.setParent(parent)
  const btn = so.createComponent(Button.getTypeName()) as Button
  btn.size = new vec3(sizeX, sizeY, 1)
  const lso = global.scene.createSceneObject("ButtonLabel")
  lso.setParent(so)
  lso.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
  const t = lso.createComponent("Component.Text") as Text
  t.text = label
  t.depthTest = true
  applyTextRole(t, "Button")
  t.horizontalAlignment = HorizontalAlignment.Center
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = HorizontalOverflow.Overflow
  t.verticalOverflow = VerticalOverflow.Overflow
  const w = sizeX - 0.5
  t.layoutRect = Rect.create(-w / 2, w / 2, -1.2, 1.2)
  const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
  btn.onTriggerUp.add(() => onClick())
  return {button: btn, label: t, item}
}

/** Yaw-only "face the camera" rotation for world-anchored UI. */
export function faceCamera(obj: Transform, camPos: vec3): void {
  const p = obj.getWorldPosition()
  const dx = camPos.x - p.x
  const dz = camPos.z - p.z
  const yaw = Math.atan2(dx, dz)
  obj.setWorldRotation(quat.angleAxis(yaw, vec3.up()))
}
