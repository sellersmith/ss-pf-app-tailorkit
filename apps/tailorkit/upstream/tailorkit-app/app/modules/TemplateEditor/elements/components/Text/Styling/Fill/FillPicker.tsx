/**
 * FillPicker - Unified fill configuration UI
 *
 * Allows users to configure text/shape fills:
 * - Solid color (with opacity)
 * - Image (with scale mode, position)
 * - Gradient (with stops and direction) - Future
 *
 * @module TemplateEditor/elements/components/Text/Styling/Fill
 */

import { useCallback, useMemo, useRef } from 'react'
import { BlockStack, InlineStack, Text, Box, Tabs } from '@shopify/polaris'
import type { Paint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import {
  isSolidPaint,
  isImagePaint,
  isGradientPaint,
  colorToSolidPaint,
} from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { SolidFillEditor } from './SolidFillEditor'
import { ImageFillEditor } from './ImageFillEditor'
import { FillPreview } from './FillPreview'
import { useTranslation } from 'react-i18next'

export interface FillPickerProps {
  /** Current fill value (Paint object or legacy color string) */
  value: Paint | string | undefined
  /** Callback when fill changes */
  onChange: (fill: Paint) => void
  /** Label for the picker */
  label?: string
  /** Disable gradient option (future feature) */
  disableGradient?: boolean
  /** Disable image option */
  disableImage?: boolean
  /** Shop domain for asset uploads */
  shopDomain?: string
}

type FillTab = 'solid' | 'image' | 'gradient'

export function FillPicker({
  value,
  onChange,
  label,
  disableGradient = true, // Gradients disabled by default for now
  disableImage = false,
  shopDomain,
}: FillPickerProps) {
  const { t } = useTranslation()
  // Normalize value to Paint object
  const normalizedValue = useMemo((): Paint => {
    if (typeof value === 'string') {
      return colorToSolidPaint(value)
    }
    return value || colorToSolidPaint('#000000')
  }, [value])

  // Cache fills by type to preserve settings when switching tabs
  // Cache clears when component unmounts (matching Figma's behavior)
  const fillCache = useRef<Partial<Record<FillTab, Paint>>>({})

  // Determine active tab from current value
  const activeTab = useMemo((): FillTab => {
    if (isImagePaint(normalizedValue)) return 'image'
    if (isGradientPaint(normalizedValue)) return 'gradient'
    return 'solid'
  }, [normalizedValue])

  // Build tabs array for Polaris Tabs component
  const tabs = useMemo(() => {
    const tabList: Array<{ id: string; content: string; panelID: string }> = [
      { id: 'solid', content: t('solid'), panelID: 'solid-panel' },
    ]
    if (!disableImage) {
      tabList.push({ id: 'image', content: t('image'), panelID: 'image-panel' })
    }
    if (!disableGradient) {
      tabList.push({ id: 'gradient', content: t('gradient'), panelID: 'gradient-panel' })
    }
    return tabList
  }, [disableImage, disableGradient, t])

  // Find the selected tab index based on activeTab
  const selectedTabIndex = useMemo(() => {
    const index = tabs.findIndex(tab => tab.id === activeTab)
    return index >= 0 ? index : 0
  }, [tabs, activeTab])

  const handleTabChange = useCallback(
    (newIndex: number) => {
      const tabId = tabs[newIndex]?.id as FillTab

      if (tabId && tabId !== activeTab) {
        // Cache current fill before switching away
        fillCache.current[activeTab] = normalizedValue

        // Check if we have a cached fill for the target type
        const cachedFill = fillCache.current[tabId]

        if (cachedFill) {
          // Restore cached fill
          onChange(cachedFill)
        } else {
          // First time using this type - use defaults
          switch (tabId) {
            case 'solid':
              onChange({ type: 'SOLID', color: '#000000', opacity: 1, visible: true })
              break
            case 'image':
              onChange({
                type: 'IMAGE',
                imageRef: '',
                scaleMode: 'FILL',
                patternSize: 'stretch',
                opacity: 1,
                visible: true,
              })
              break
            case 'gradient':
              onChange({
                type: 'GRADIENT_LINEAR',
                stops: [
                  { position: 0, color: '#000000' },
                  { position: 1, color: '#ffffff' },
                ],
                opacity: 1,
                visible: true,
              })
              break
          }
        }
      }
    },
    [activeTab, normalizedValue, onChange, tabs]
  )

  // Only show tabs if more than one option
  const showTabs = tabs.length > 1

  const currentTab = tabs[selectedTabIndex]?.id as FillTab

  return (
    <BlockStack gap="300">
      {/* Header with preview */}
      {label && (
        <InlineStack align="space-between" blockAlign="center">
          <Text as="p" variant="bodyMd">
            {label}
          </Text>
          <FillPreview paint={normalizedValue} size="small" />
        </InlineStack>
      )}

      {/* Tab selector and content */}
      {showTabs ? (
        <Tabs tabs={tabs} selected={selectedTabIndex} onSelect={handleTabChange}>
          <Box minHeight="100px">
            {currentTab === 'solid' && (
              <SolidFillEditor
                value={isSolidPaint(normalizedValue) ? normalizedValue : undefined}
                onChange={onChange}
              />
            )}

            {currentTab === 'image' && (
              <ImageFillEditor
                value={isImagePaint(normalizedValue) ? normalizedValue : undefined}
                onChange={onChange}
                shopDomain={shopDomain}
              />
            )}

            {currentTab === 'gradient' && (
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  {t('gradient-coming-soon')}
                </Text>
              </BlockStack>
            )}
          </Box>
        </Tabs>
      ) : (
        <Box minHeight="100px">
          <SolidFillEditor value={isSolidPaint(normalizedValue) ? normalizedValue : undefined} onChange={onChange} />
        </Box>
      )}
    </BlockStack>
  )
}
