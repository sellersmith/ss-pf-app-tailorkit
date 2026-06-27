/**
 * Gift Box Shape Generator
 */

import type { PathCommand } from '../../../svg'
import type { ObjectPathResult } from '../types'
import { K, BIRTHDAY_COLORS } from './colors'

/**
 * Generate gift box shape
 */
export function generateGiftBox(cx: number, cy: number, width: number, height: number): ObjectPathResult[] {
  const colors = BIRTHDAY_COLORS.gift
  const w = width
  const h = height

  // Main box body
  const boxBody: PathCommand[] = [
    { type: 'M', x: cx - w * 0.4, y: cy - h * 0.15 },
    { type: 'L', x: cx + w * 0.4, y: cy - h * 0.15 },
    { type: 'L', x: cx + w * 0.4, y: cy + h * 0.4 },
    { type: 'L', x: cx - w * 0.4, y: cy + h * 0.4 },
    { type: 'Z', x: cx - w * 0.4, y: cy - h * 0.15 },
  ]

  // Box lid
  const boxLid: PathCommand[] = [
    { type: 'M', x: cx - w * 0.45, y: cy - h * 0.3 },
    { type: 'L', x: cx + w * 0.45, y: cy - h * 0.3 },
    { type: 'L', x: cx + w * 0.45, y: cy - h * 0.15 },
    { type: 'L', x: cx - w * 0.45, y: cy - h * 0.15 },
    { type: 'Z', x: cx - w * 0.45, y: cy - h * 0.3 },
  ]

  // Vertical ribbon
  const ribbonV: PathCommand[] = [
    { type: 'M', x: cx - w * 0.08, y: cy - h * 0.3 },
    { type: 'L', x: cx + w * 0.08, y: cy - h * 0.3 },
    { type: 'L', x: cx + w * 0.08, y: cy + h * 0.4 },
    { type: 'L', x: cx - w * 0.08, y: cy + h * 0.4 },
    { type: 'Z', x: cx - w * 0.08, y: cy - h * 0.3 },
  ]

  // Horizontal ribbon
  const ribbonH: PathCommand[] = [
    { type: 'M', x: cx - w * 0.4, y: cy + h * 0.05 },
    { type: 'L', x: cx + w * 0.4, y: cy + h * 0.05 },
    { type: 'L', x: cx + w * 0.4, y: cy + h * 0.2 },
    { type: 'L', x: cx - w * 0.4, y: cy + h * 0.2 },
    { type: 'Z', x: cx - w * 0.4, y: cy + h * 0.05 },
  ]

  // Bow left loop
  const bowLeft: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.3 },
    {
      type: 'C',
      x: cx - w * 0.25,
      y: cy - h * 0.45,
      cp1: { x: cx - w * 0.1, y: cy - h * 0.35 },
      cp2: { x: cx - w * 0.25, y: cy - h * 0.4 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.3,
      cp1: { x: cx - w * 0.25, y: cy - h * 0.5 },
      cp2: { x: cx - w * 0.05, y: cy - h * 0.4 },
    },
    { type: 'Z', x: cx, y: cy - h * 0.3 },
  ]

  // Bow right loop
  const bowRight: PathCommand[] = [
    { type: 'M', x: cx, y: cy - h * 0.3 },
    {
      type: 'C',
      x: cx + w * 0.25,
      y: cy - h * 0.45,
      cp1: { x: cx + w * 0.1, y: cy - h * 0.35 },
      cp2: { x: cx + w * 0.25, y: cy - h * 0.4 },
    },
    {
      type: 'C',
      x: cx,
      y: cy - h * 0.3,
      cp1: { x: cx + w * 0.25, y: cy - h * 0.5 },
      cp2: { x: cx + w * 0.05, y: cy - h * 0.4 },
    },
    { type: 'Z', x: cx, y: cy - h * 0.3 },
  ]

  // Bow center
  const bowCenterR = w * 0.06
  const bowCenterY = cy - h * 0.32
  const bowCenter: PathCommand[] = [
    { type: 'M', x: cx, y: bowCenterY - bowCenterR },
    {
      type: 'C',
      x: cx + bowCenterR,
      y: bowCenterY,
      cp1: { x: cx + bowCenterR * K, y: bowCenterY - bowCenterR },
      cp2: { x: cx + bowCenterR, y: bowCenterY - bowCenterR * K },
    },
    {
      type: 'C',
      x: cx,
      y: bowCenterY + bowCenterR,
      cp1: { x: cx + bowCenterR, y: bowCenterY + bowCenterR * K },
      cp2: { x: cx + bowCenterR * K, y: bowCenterY + bowCenterR },
    },
    {
      type: 'C',
      x: cx - bowCenterR,
      y: bowCenterY,
      cp1: { x: cx - bowCenterR * K, y: bowCenterY + bowCenterR },
      cp2: { x: cx - bowCenterR, y: bowCenterY + bowCenterR * K },
    },
    {
      type: 'C',
      x: cx,
      y: bowCenterY - bowCenterR,
      cp1: { x: cx - bowCenterR, y: bowCenterY - bowCenterR * K },
      cp2: { x: cx - bowCenterR * K, y: bowCenterY - bowCenterR },
    },
    { type: 'Z', x: cx, y: bowCenterY - bowCenterR },
  ]

  return [
    {
      id: 'gift-box',
      name: 'Box',
      commands: boxBody,
      fill: colors.box,
      stroke: colors.boxStroke,
      strokeWidth: 1,
      zIndex: 0,
    },
    {
      id: 'gift-lid',
      name: 'Lid',
      commands: boxLid,
      fill: colors.box,
      stroke: colors.boxStroke,
      strokeWidth: 1,
      zIndex: 1,
    },
    {
      id: 'gift-ribbon-v',
      name: 'Vertical Ribbon',
      commands: ribbonV,
      fill: colors.ribbon,
      stroke: colors.ribbonStroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'gift-ribbon-h',
      name: 'Horizontal Ribbon',
      commands: ribbonH,
      fill: colors.ribbon,
      stroke: colors.ribbonStroke,
      strokeWidth: 0.5,
      zIndex: 2,
    },
    {
      id: 'gift-bow-left',
      name: 'Bow Left',
      commands: bowLeft,
      fill: colors.bow,
      stroke: colors.ribbonStroke,
      strokeWidth: 0.5,
      zIndex: 3,
    },
    {
      id: 'gift-bow-right',
      name: 'Bow Right',
      commands: bowRight,
      fill: colors.bow,
      stroke: colors.ribbonStroke,
      strokeWidth: 0.5,
      zIndex: 3,
    },
    {
      id: 'gift-bow-center',
      name: 'Bow Center',
      commands: bowCenter,
      fill: colors.bow,
      stroke: colors.ribbonStroke,
      strokeWidth: 0.5,
      zIndex: 4,
    },
  ]
}
