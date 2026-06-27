/**
 * Desktop-specific add elements menu component with individual buttons
 */

import { Button, Icon, InlineStack, Text } from '@shopify/polaris'
import { ImageIcon, ImageMagicIcon, PaintBrushRoundIcon, TextIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { SubInspectorStore, subInspectorStoreActions } from '~/stores/canvas/subInspector'
import type { LayerType } from '~/types/psd'
import { ELayerType } from '~/types/psd'
import type { IImageQuery } from '~/types/shopify-files'
import ButtonAddElements, { EElementType } from '../../Outline/Header/ButtonAddElements'
import { useCallback } from 'react'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { useStore } from '~/libs/external-store'

export interface DesktopAddElementsMenuProps {
  addElements: (type: LayerType, mediaFiles?: IImageQuery[] | null) => void
  toggleOpenImagesDialog: () => void
  toggleOpenClipartsDialog: () => void
  // Removed popover props; AI now opens in sub-inspector panel
  /**
   * Types to exclude from the primary toolbar (they will appear under "More")
   */
  excludeTypes?: EElementType[]
}

/**
 * Desktop menu component that renders individual buttons for element creation
 */
export function DesktopAddElementsMenu({
  addElements,
  toggleOpenImagesDialog,
  toggleOpenClipartsDialog,
  excludeTypes = [],
}: DesktopAddElementsMenuProps) {
  const { t } = useTranslation()
  const openAIPanel = useCallback(() => {
    // Clear the selection
    LayerStoreSelection.dispatch({
      type: 'SET_LAYER_STORE_SELECTION',
      payload: { clickedLayerStore: null, checkedLayerStores: [] },
    })

    subInspectorStoreActions.openSubInspector('ai-image-inspector', {
      title: t('generate-images'),
    })
  }, [t])

  const isOpenAIGenerateImageInspector = useStore(SubInspectorStore, state => state.key === 'ai-image-inspector')

  return (
    <InlineStack gap="200" blockAlign="center" wrap={false}>
      {/* Text button */}
      {!excludeTypes.includes(EElementType.TEXT) && (
        <Button
          id="quick-add-text-btn"
          onClick={() => addElements(ELayerType.TEXT, null)}
          icon={<Icon source={TextIcon} tone="base" />}
          size="large"
        >
          {t('text')}
        </Button>
      )}

      {/* Image button */}
      {!excludeTypes.includes(EElementType.IMAGE) && (
        <Button
          id="quick-add-image-btn"
          onClick={toggleOpenImagesDialog}
          icon={<Icon source={ImageIcon} tone="base" />}
          size="large"
        >
          {t('image')}
        </Button>
      )}

      {/* AI Image button opens sub-inspector */}
      {!excludeTypes.includes(EElementType.AI_IMAGE) && (
        <Button
          id="quick-add-ai-image-btn"
          pressed={isOpenAIGenerateImageInspector}
          onClick={openAIPanel}
          icon={<Icon source={ImageMagicIcon} tone="success" />}
          size="large"
        >
          {/* @ts-ignore */}
          <Text variant="bodyMd" fontWeight="medium" as="span" tone="success">
            {t('ai-image')}
          </Text>
        </Button>
      )}

      {/* Clipart button */}
      {!excludeTypes.includes(EElementType.CLIPART) && (
        <Button
          id="quick-add-clipart-btn"
          onClick={toggleOpenClipartsDialog}
          icon={<Icon source={PaintBrushRoundIcon} tone="base" />}
          size="large"
        >
          {t('clipart')}
        </Button>
      )}

      {/* More button with dropdown for additional elements */}
      <ButtonAddElements addElements={addElements} excludeTypes={excludeTypes} />
    </InlineStack>
  )
}
