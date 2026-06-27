/**
 * Renders a list of PlanFlag banners with appropriate severity tones.
 */

import { Banner, BlockStack } from '@shopify/polaris'
import type { PlanFlag } from '~/libs/langchain/skills/types'

interface PlanFlagsListProps {
  flags: PlanFlag[]
}

const FLAG_TONES: Record<PlanFlag['type'], 'warning' | 'info' | 'critical'> = {
  limitation: 'warning',
  suggestion: 'info',
  manual_required: 'critical',
}

export function PlanFlagsList({ flags }: PlanFlagsListProps) {
  if (!flags.length) return null

  return (
    <BlockStack gap="200">
      {flags.map((flag, i) => (
        <Banner key={i} tone={FLAG_TONES[flag.type]}>
          {flag.message}
        </Banner>
      ))}
    </BlockStack>
  )
}
