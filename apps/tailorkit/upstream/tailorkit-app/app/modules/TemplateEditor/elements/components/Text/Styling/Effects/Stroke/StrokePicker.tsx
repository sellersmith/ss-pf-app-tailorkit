/**
 * StrokePicker - Unified stroke configuration UI
 *
 * Allows users to configure text/shape strokes:
 * - Solid color (with opacity)
 * - Image (with scale mode, position, filters)
 * - Gradient (with stops and direction) - Future
 *
 * Similar to FillPicker but includes stroke weight configuration.
 *
 * @module TemplateEditor/elements/components/Text/Styling/Effects/Stroke
 */

import { useCallback, useMemo } from 'react'
import { BlockStack, InlineStack, Text, Box, Tabs } from '@shopify/polaris'
import type { Paint } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import {
  isSolidPaint,
  isImagePaint,
  isGradientPaint,
  colorToSolidPaint,
} from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { SolidFillEditor } from '../../Fill/SolidFillEditor'
import { ImageFillEditor } from '../../Fill/ImageFillEditor'
import { FillPreview } from '../../Fill/FillPreview'
import { StrokeWeight } from './StrokeWeight'
import { useTranslation } from 'react-i18next'

export interface StrokePickerProps {
  /** Current stroke paint value */
  value: Paint | undefined
  /** Stroke weight */
  strokeWeight: number
  /** Callback when stroke paint changes */
  onChange: (paint: Paint) => void
  /** Callback when stroke weight changes */
  onChangeWeight: (weight: number) => void
  /** Disable gradient option (future feature) */
  disableGradient?: boolean
  /** Disable image option */
  disableImage?: boolean
  /** Shop domain for asset uploads */
  shopDomain?: string
}

type StrokeTab = 'solid' | 'image' | 'gradient'

export function StrokePicker({
  value,
  strokeWeight,
  onChange,
  onChangeWeight,
  disableGradient = true, // Gradients disabled by default for now
  disableImage = false,
  shopDomain,
}: StrokePickerProps) {
  const { t } = useTranslation()

  // Normalize value to Paint object
  const normalizedValue = useMemo((): Paint => {
    return value || colorToSolidPaint('#000000')
  }, [value])

  // Determine active tab from current value
  const activeTab = useMemo((): StrokeTab => {
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
      const tabId = tabs[newIndex]?.id as StrokeTab

      // Create default paint for new tab if switching types
      if (tabId && tabId !== activeTab) {
        switch (tabId) {
          case 'solid':
            onChange({ type: 'SOLID', color: '#000000', opacity: 1, visible: true })
            break
          case 'image':
            onChange({
              type: 'IMAGE',
              imageRef: '',
              scaleMode: 'FILL',
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
    },
    [activeTab, onChange, tabs]
  )

  // Only show tabs if more than one option
  const showTabs = tabs.length > 1

  const currentTab = tabs[selectedTabIndex]?.id as StrokeTab

  return (
    <BlockStack gap="300">
      {/* Header with preview and weight */}
      <InlineStack align="space-between" blockAlign="center" gap="200">
        <InlineStack gap="200" blockAlign="center">
          <Text as="p" variant="bodyMd">
            {t('stroke')}
          </Text>
          <FillPreview paint={normalizedValue} size="small" />
        </InlineStack>
        <StrokeWeight strokeWeight={strokeWeight} onChangeStrokeWeight={onChangeWeight} />
      </InlineStack>

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
