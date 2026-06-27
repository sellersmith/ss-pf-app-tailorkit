import { useEffect, useMemo, useState } from 'react'
import type { IPersonalizedProps } from '~/modules/TemplateEditor/components/Preview/components/Inspector/Personalized'
import { Personalized } from '~/modules/TemplateEditor/components/Preview/components/Inspector/Personalized'
import type { GlobalStyling } from '~/types/global-styling'
import { createDefaultGlobalStyling } from '~/types/global-styling'
import { GlobalStylingService } from '~/api/services/global-styling'
import { applyGlobalStylingToContainer } from '~/components/GlobalStyling/utils/applyGlobalStyling'

export interface PersonalizedWithGlobalStylingProps extends IPersonalizedProps {
  styling?: GlobalStyling
}

export function PersonalizedWithGlobalStyling(props: PersonalizedWithGlobalStylingProps) {
  const { styling: stylingProp, ...rest } = props

  const [fetchedStyling, setFetchedStyling] = useState<GlobalStyling | null>(null)

  // Prefer provided styling; otherwise fetch once
  const styling = useMemo<GlobalStyling>(
    () => stylingProp || fetchedStyling || createDefaultGlobalStyling(),
    [stylingProp, fetchedStyling]
  )

  useEffect(() => {
    if (stylingProp) return
    let cancelled = false
    ;(async () => {
      const gs = await GlobalStylingService.get(true)
      if (!cancelled) setFetchedStyling(gs)
    })()
    return () => {
      cancelled = true
    }
  }, [stylingProp])

  // Apply tokens to :root for consistency across surfaces
  useEffect(() => {
    applyGlobalStylingToContainer(styling, document.documentElement)
  }, [styling])

  return <Personalized titleText={fetchedStyling?.heading.text || rest.titleText || 'PERSONALIZED DESIGN'} {...rest} />
}

export default PersonalizedWithGlobalStyling
