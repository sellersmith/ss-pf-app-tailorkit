import { useEffect, useMemo, useState } from 'react'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import type { FontLoader } from 'extensions/tailorkit-src/src/assets/utils/font-loader'
import { TEMPLATE_EDITOR_TRANSMISSION_EVENTS } from '~/modules/TemplateEditor/constants'
import type { EffectConfig } from '~/modules/TemplateEditor/elements/effects/types'

interface UseTextEffectsRendererParams {
  fontFamily?: string
  fontSrc?: string
  fontLoader: FontLoader
  effects?: EffectConfig[]
  spriteRef?: any
}

export function useTextEffectsRenderer({
  fontFamily = 'Arial',
  fontSrc,
  fontLoader,
  effects = [],
  spriteRef,
}: UseTextEffectsRendererParams) {
  const [isReady, setIsReady] = useState(false)
  const [showShadow, setShowShadow] = useState(false)

  // Load font
  useEffect(() => {
    setIsReady(false)
    ;(async () => {
      try {
        await fontLoader.loadFont(fontFamily, fontSrc)
      } catch (error) {
        console.error('Error loading font:', error)
      } finally {
        setIsReady(true)
      }
    })()
  }, [fontLoader, fontFamily, fontSrc])

  // Trigger transformer update after font loads
  useEffect(() => {
    if (!isReady) return
    requestAnimationFrame(() => {
      setTimeout(() => {
        Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.UPDATE_TRANSFORMER)
      }, 0)
    })
  }, [isReady])

  // Shadow timing hack to avoid initial layout jumps
  useEffect(() => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        setShowShadow(true)
      }, 500)
    })
  }, [spriteRef])

  const keyTextControl = useMemo(() => {
    return `${isReady}`
  }, [isReady])

  const hasInnerShadows = useMemo(() => {
    return Array.isArray(effects) && effects.some(e => e?.type === 'INNER_SHADOW' && e?.visible !== false)
  }, [effects])

  const useAdvancedRendering = hasInnerShadows || (Array.isArray(effects) && effects.length > 0)

  return { isReady, showShadow, keyTextControl, hasInnerShadows, useAdvancedRendering }
}
