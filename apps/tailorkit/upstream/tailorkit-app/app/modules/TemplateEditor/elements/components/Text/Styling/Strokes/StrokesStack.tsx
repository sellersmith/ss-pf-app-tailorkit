/**
 * StrokesStack - Main UI component for managing multiple strokes
 *
 * Features:
 * - Add up to 5 strokes
 * - Drag to reorder strokes
 * - Each stroke: Paint (color/image/gradient), Thickness, Visibility
 * - TextStudio-style wrapping (outer strokes wrap inner ones)
 *
 * @module TemplateEditor/elements/components/Text/Styling/Strokes
 */

import { BlockStack, Box, Button, InlineStack, Text, Tooltip } from '@shopify/polaris'
import { PlusIcon } from '@shopify/polaris-icons'
import { MAX_STROKES } from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { SortableList } from '~/components/common/SortableList/SortableList'
import type TemplateElement from '../../..'
import { useStrokesManager } from './hooks/useStrokesManager'
import { StrokeListItem } from './StrokeListItem'
import type { TLayerStore } from '~/stores/modules/layer'

interface StrokesStackProps {
  element: TemplateElement<any, any>
  clickedLayerStore?: TLayerStore | null
  t: (key: string) => string
  shopDomain?: string
}

export function StrokesStack({ element, clickedLayerStore, t, shopDomain }: StrokesStackProps) {
  const {
    // State
    strokes,
    canAddStroke,

    // UI State
    settingsOpen,
    toggleSettingsOpen,
    closeSettings,

    // Handlers
    handleAddStroke,
    handleRemoveStroke,
    handleToggleVisible,
    handleReorder,
    handlePaintChange,
    handleWeightChange,
  } = useStrokesManager({ element, clickedLayerStore })

  return (
    <Box>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h4" variant="headingSm">
            {t('strokes')}
          </Text>
          <Tooltip content={canAddStroke ? t('add-stroke') : `Maximum ${MAX_STROKES} strokes`}>
            <Button icon={PlusIcon} variant="tertiary" onClick={() => handleAddStroke(true)} disabled={!canAddStroke}>
              {t('add-stroke')}
            </Button>
          </Tooltip>
        </InlineStack>

        {strokes.length === 0 ? null : (
          <SortableList
            items={strokes.map((s, i) => ({ id: s._id, index: i, payload: s }))}
            onChange={handleReorder}
            renderItem={item => {
              const idx = (item as any).index as number
              const stroke = (item as any).payload
              const strokeId = stroke._id
              const isOpen = settingsOpen[strokeId] ?? false

              return (
                <StrokeListItem
                  stroke={stroke}
                  index={idx}
                  isSettingsOpen={isOpen}
                  onToggleSettings={() => toggleSettingsOpen(strokeId)}
                  onCloseSettings={() => closeSettings(strokeId)}
                  onToggleVisible={handleToggleVisible}
                  onRemove={handleRemoveStroke}
                  onPaintChange={handlePaintChange}
                  onWeightChange={handleWeightChange}
                  t={t}
                  shopDomain={shopDomain}
                />
              )
            }}
          />
        )}
      </BlockStack>
    </Box>
  )
}
