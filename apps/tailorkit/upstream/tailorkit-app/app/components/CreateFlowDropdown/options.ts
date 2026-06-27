/**
 * Single source of truth for the create-flow dropdown menu.
 * Each option maps to a CreateFlow value and carries title/subtitle copy
 * matching the install intent page cards (so vocabulary is consistent
 * between first-impression and recurring use).
 */

import type { IconSource } from '@shopify/polaris'
import { ImageMagicIcon, PaintBrushFlatIcon, ThemeTemplateIcon } from '@shopify/polaris-icons'
import type { CreateFlow } from '~/models/Shop'

export interface CreateFlowOption {
  flow: CreateFlow
  title: string
  subtitle: string
  icon: IconSource
}

export const CREATE_FLOW_OPTIONS: CreateFlowOption[] = [
  {
    flow: 'quick_setup',
    title: 'Quick Setup',
    subtitle: 'Guided 5-step wizard with realistic mockups',
    icon: ImageMagicIcon,
  },
  {
    flow: 'full_editor',
    title: 'Full Editor',
    subtitle: 'Full control over layers, effects, and templates',
    icon: PaintBrushFlatIcon,
  },
  {
    flow: 'charm_builder',
    title: 'Charm Builder',
    subtitle: 'Sell custom jewelry charms with drag-and-place placeholders',
    icon: ThemeTemplateIcon,
  },
]

export const DEFAULT_CREATE_FLOW: CreateFlow = 'quick_setup'

export function getOption(flow: CreateFlow): CreateFlowOption {
  return CREATE_FLOW_OPTIONS.find(opt => opt.flow === flow) ?? CREATE_FLOW_OPTIONS[0]
}
