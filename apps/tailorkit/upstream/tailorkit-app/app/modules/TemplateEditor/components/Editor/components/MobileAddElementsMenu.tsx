/**
 * Mobile-specific add elements menu component with ActionList
 */

import { ActionList, Box, Button, Icon, Popover, Text } from '@shopify/polaris'
import { ImageIcon, ImageMagicIcon, PaintBrushRoundIcon, PlusIcon, TextIcon, UploadIcon } from '@shopify/polaris-icons'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ELayerType } from '~/types/psd'
import type { LayerType } from '~/types/psd'
import type { IImageQuery } from '~/types/shopify-files'
import { subInspectorStoreActions } from '~/stores/canvas/subInspector'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'

export interface MobileAddElementsMenuProps {
  addElements: (type: LayerType, mediaFiles?: IImageQuery[] | null) => void
  toggleOpenImagesDialog: () => void
  toggleOpenClipartsDialog: () => void
  toggleOpenPSDDialog: () => void
}

/**
 * Mobile menu component that renders a popover with ActionList for element creation
 */
export function MobileAddElementsMenu({
  addElements,
  toggleOpenImagesDialog,
  toggleOpenClipartsDialog,
  toggleOpenPSDDialog,
}: MobileAddElementsMenuProps) {
  const { t } = useTranslation()
  const [popoverActive, setPopoverActive] = useState(false)

  const togglePopoverActive = useCallback((state?: boolean) => {
    setPopoverActive(prev => state ?? !prev)
  }, [])

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

  const handleAction = useCallback(
    (action: () => void) => {
      action()
      togglePopoverActive(false)
    },
    [togglePopoverActive]
  )

  return (
    <Popover
      active={popoverActive}
      activator={
        <Button
          id="quick-add-elements-btn"
          icon={<Icon source={PlusIcon} tone="base" />}
          variant="primary"
          disclosure={popoverActive ? 'up' : 'down'}
          onClick={() => togglePopoverActive()}
        >
          {t('add-elements')}
        </Button>
      }
      autofocusTarget="first-node"
      preferredPosition="above"
      onClose={() => togglePopoverActive(false)}
    >
      <Box padding="100">
        <ActionList
          actionRole="menuitem"
          items={[
            {
              id: 'al-text',
              content: t('text'),
              prefix: <Icon source={TextIcon} tone="base" />,
              onAction: () => handleAction(() => addElements(ELayerType.TEXT, null)),
            },
            {
              id: 'al-image',
              content: t('image'),
              prefix: <Icon source={ImageIcon} tone="base" />,
              onAction: () => handleAction(toggleOpenImagesDialog),
            },
            {
              id: 'al-ai',
              // @ts-ignore
              content: (
                <Text variant="bodyMd" fontWeight="medium" as="span" tone="success">
                  {t('ai-image')}
                </Text>
              ),
              prefix: <Icon source={ImageMagicIcon} tone="success" />,
              onAction: () => handleAction(openAIPanel),
            },
            {
              id: 'al-clipart',
              content: t('clipart'),
              prefix: <Icon source={PaintBrushRoundIcon} tone="base" />,
              onAction: () => handleAction(toggleOpenClipartsDialog),
            },
            {
              id: 'al-psd',
              content: t('psd-file'),
              prefix: <Icon source={UploadIcon} tone="base" />,
              onAction: () => handleAction(toggleOpenPSDDialog),
            },
            {
              id: 'al-imageless',
              content: t('imageless'),
              prefix: <Icon source={PlusIcon} tone="base" />,
              onAction: () => handleAction(() => addElements(ELayerType.IMAGELESS, null)),
            },
            {
              id: 'al-multilayout',
              content: t('multi-layout'),
              prefix: <Icon source={PlusIcon} tone="base" />,
              onAction: () => handleAction(() => addElements(ELayerType.MULTI_LAYOUT, null)),
            },
          ]}
        />
      </Box>
    </Popover>
  )
}
