/**
 * Dolphin Shape Generator
 * Playful dolphin with curved body and fins
 */

import type { PathCommand } from '../../svg'
import type { FantasyPathPart } from '../fantasy/types'
import { wrapFantasyGenerator } from '../fantasy/types'
import { colors, generateCircle } from './helpers'

const _generateDolphinCartoon = (cx: number, cy: number, width: number, height: number): FantasyPathPart[] => {
  const parts: FantasyPathPart[] = []
  const scale = Math.min(width, height) * 0.4

  // Main body
  const bodyCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.5, y: cy },
    {
      type: 'C',
      x: cx - scale * 0.1,
      y: cy - scale * 0.25,
      cp1: { x: cx - scale * 0.5, y: cy - scale * 0.2 },
      cp2: { x: cx - scale * 0.3, y: cy - scale * 0.3 },
    },
    {
      type: 'C',
      x: cx + scale * 0.35,
      y: cy - scale * 0.1,
      cp1: { x: cx + scale * 0.1, y: cy - scale * 0.25 },
      cp2: { x: cx + scale * 0.3, y: cy - scale * 0.2 },
    },
    {
      type: 'C',
      x: cx + scale * 0.35,
      y: cy + scale * 0.1,
      cp1: { x: cx + scale * 0.4, y: cy },
      cp2: { x: cx + scale * 0.4, y: cy + scale * 0.05 },
    },
    {
      type: 'C',
      x: cx - scale * 0.1,
      y: cy + scale * 0.2,
      cp1: { x: cx + scale * 0.3, y: cy + scale * 0.15 },
      cp2: { x: cx + scale * 0.1, y: cy + scale * 0.2 },
    },
    {
      type: 'C',
      x: cx - scale * 0.5,
      y: cy,
      cp1: { x: cx - scale * 0.3, y: cy + scale * 0.25 },
      cp2: { x: cx - scale * 0.5, y: cy + scale * 0.15 },
    },
    { type: 'Z', x: cx - scale * 0.5, y: cy },
  ]

  parts.push({
    commands: bodyCommands,
    fill: '#546E7A', // Grayish blue
    stroke: colors.outline,
    strokeWidth: scale * 0.04,
    zIndex: 10,
  })

  // Belly (lighter)
  const bellyCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.35, y: cy + scale * 0.05 },
    {
      type: 'C',
      x: cx + scale * 0.25,
      y: cy + scale * 0.05,
      cp1: { x: cx - scale * 0.1, y: cy + scale * 0.15 },
      cp2: { x: cx + scale * 0.1, y: cy + scale * 0.12 },
    },
    {
      type: 'C',
      x: cx - scale * 0.35,
      y: cy + scale * 0.05,
      cp1: { x: cx + scale * 0.1, y: cy + scale * 0.02 },
      cp2: { x: cx - scale * 0.1, y: cy },
    },
    { type: 'Z', x: cx - scale * 0.35, y: cy + scale * 0.05 },
  ]

  parts.push({
    commands: bellyCommands,
    fill: '#B0BEC5', // Light gray
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 11,
  })

  // Snout/beak
  const snoutCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.45, y: cy - scale * 0.05 },
    {
      type: 'C',
      x: cx - scale * 0.7,
      y: cy,
      cp1: { x: cx - scale * 0.55, y: cy - scale * 0.08 },
      cp2: { x: cx - scale * 0.65, y: cy - scale * 0.05 },
    },
    {
      type: 'C',
      x: cx - scale * 0.45,
      y: cy + scale * 0.05,
      cp1: { x: cx - scale * 0.65, y: cy + scale * 0.05 },
      cp2: { x: cx - scale * 0.55, y: cy + scale * 0.08 },
    },
    { type: 'Z', x: cx - scale * 0.45, y: cy - scale * 0.05 },
  ]

  parts.push({
    commands: snoutCommands,
    fill: '#546E7A',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 12,
  })

  // Dorsal fin
  const dorsalCommands: PathCommand[] = [
    { type: 'M', x: cx, y: cy - scale * 0.22 },
    {
      type: 'C',
      x: cx + scale * 0.2,
      y: cy - scale * 0.5,
      cp1: { x: cx + scale * 0.05, y: cy - scale * 0.35 },
      cp2: { x: cx + scale * 0.15, y: cy - scale * 0.5 },
    },
    {
      type: 'C',
      x: cx + scale * 0.2,
      y: cy - scale * 0.18,
      cp1: { x: cx + scale * 0.25, y: cy - scale * 0.45 },
      cp2: { x: cx + scale * 0.25, y: cy - scale * 0.25 },
    },
    { type: 'Z', x: cx, y: cy - scale * 0.22 },
  ]

  parts.push({
    commands: dorsalCommands,
    fill: '#455A64',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 11,
  })

  // Tail flukes
  const tailCommands: PathCommand[] = [
    { type: 'M', x: cx + scale * 0.35, y: cy },
    {
      type: 'C',
      x: cx + scale * 0.6,
      y: cy - scale * 0.25,
      cp1: { x: cx + scale * 0.45, y: cy - scale * 0.1 },
      cp2: { x: cx + scale * 0.55, y: cy - scale * 0.2 },
    },
    {
      type: 'C',
      x: cx + scale * 0.45,
      y: cy,
      cp1: { x: cx + scale * 0.55, y: cy - scale * 0.15 },
      cp2: { x: cx + scale * 0.5, y: cy - scale * 0.05 },
    },
    {
      type: 'C',
      x: cx + scale * 0.6,
      y: cy + scale * 0.25,
      cp1: { x: cx + scale * 0.5, y: cy + scale * 0.05 },
      cp2: { x: cx + scale * 0.55, y: cy + scale * 0.15 },
    },
    {
      type: 'C',
      x: cx + scale * 0.35,
      y: cy,
      cp1: { x: cx + scale * 0.55, y: cy + scale * 0.2 },
      cp2: { x: cx + scale * 0.45, y: cy + scale * 0.1 },
    },
    { type: 'Z', x: cx + scale * 0.35, y: cy },
  ]

  parts.push({
    commands: tailCommands,
    fill: '#455A64',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 9,
  })

  // Flipper
  const flipperCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.15, y: cy + scale * 0.1 },
    {
      type: 'C',
      x: cx - scale * 0.35,
      y: cy + scale * 0.35,
      cp1: { x: cx - scale * 0.25, y: cy + scale * 0.15 },
      cp2: { x: cx - scale * 0.35, y: cy + scale * 0.25 },
    },
    {
      type: 'C',
      x: cx - scale * 0.05,
      y: cy + scale * 0.15,
      cp1: { x: cx - scale * 0.25, y: cy + scale * 0.35 },
      cp2: { x: cx - scale * 0.1, y: cy + scale * 0.2 },
    },
    { type: 'Z', x: cx - scale * 0.15, y: cy + scale * 0.1 },
  ]

  parts.push({
    commands: flipperCommands,
    fill: '#455A64',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 11,
  })

  // Eye
  parts.push({
    commands: generateCircle(cx - scale * 0.3, cy - scale * 0.08, scale * 0.05),
    fill: colors.eye,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 13,
  })

  // Eye highlight
  parts.push({
    commands: generateCircle(cx - scale * 0.32, cy - scale * 0.1, scale * 0.015),
    fill: colors.eyeHighlight,
    stroke: 'none',
    strokeWidth: 0,
    zIndex: 14,
  })

  // Smile
  const smileCommands: PathCommand[] = [
    { type: 'M', x: cx - scale * 0.55, y: cy + scale * 0.02 },
    {
      type: 'C',
      x: cx - scale * 0.4,
      y: cy + scale * 0.08,
      cp1: { x: cx - scale * 0.5, y: cy + scale * 0.06 },
      cp2: { x: cx - scale * 0.45, y: cy + scale * 0.08 },
    },
  ]

  parts.push({
    commands: smileCommands,
    fill: 'none',
    stroke: colors.outline,
    strokeWidth: scale * 0.02,
    zIndex: 12,
  })

  return parts
}

export const generateDolphinCartoon = wrapFantasyGenerator(_generateDolphinCartoon, 'dolphin')
