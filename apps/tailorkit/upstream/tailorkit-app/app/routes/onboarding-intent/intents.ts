/**
 * Registry of cards shown on the install intent page.
 *
 * Three "commit" cards map 1:1 to CreateFlow values used by the dropdown.
 * One "demo" card opens an external storefront demo in a new tab without
 * persisting any flow choice — merchant can return to the page and pick a
 * real flow afterwards.
 */

import type { CreateFlow } from '~/models/Shop'
import { ImageMagicIcon, PaintBrushFlatIcon, ExternalIcon, ThemeTemplateIcon } from '@shopify/polaris-icons'
import type { IconSource } from '@shopify/polaris'

interface CommitIntentCard {
  kind: 'commit'
  flow: CreateFlow
  title: string
  subtitle: string
  icon: IconSource
}

interface DemoIntentCard {
  kind: 'demo'
  href: string
  title: string
  subtitle: string
  icon: IconSource
}

export type IntentCardConfig = CommitIntentCard | DemoIntentCard

// Re-export from API constants for single source of truth across routes.
export { CREATE_FLOWS } from '~/routes/api.onboarding-flow-router/constants'

export const STOREFRONT_DEMO_URL = 'https://demo.tailorkit.io/collections/recommendation1'

export const INTENT_CARDS: IntentCardConfig[] = [
  {
    kind: 'commit',
    flow: 'quick_setup',
    title: 'Quick Setup',
    subtitle: 'Guided 5-step wizard with realistic mockups',
    icon: ImageMagicIcon,
  },
  {
    kind: 'commit',
    flow: 'full_editor',
    title: 'Full Editor',
    subtitle: 'Full control over layers, effects, and templates',
    icon: PaintBrushFlatIcon,
  },
  {
    kind: 'commit',
    flow: 'charm_builder',
    title: 'Charm Builder',
    subtitle: 'Sell custom jewelry charms with drag-and-place placeholders',
    icon: ThemeTemplateIcon,
  },
  {
    kind: 'demo',
    href: STOREFRONT_DEMO_URL,
    title: 'See Live Demo',
    subtitle: 'Try a personalized product on a sample storefront',
    icon: ExternalIcon,
  },
]
