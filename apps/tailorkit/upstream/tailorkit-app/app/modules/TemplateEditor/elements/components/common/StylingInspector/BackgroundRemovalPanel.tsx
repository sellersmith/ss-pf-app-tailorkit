import { BlockStack, Box, Button, ChoiceList, Text } from '@shopify/polaris'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '~/libs/external-store'
import { useBackgroundRemoval } from '~/modules/TemplateEditor/hooks/useBackgroundRemoval'
import { ImageLoadingStore } from '~/stores/modules/image-loading-store'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import { ELayerType } from '~/types/psd'
import type TemplateElement from '../..'

interface BackgroundRemovalPanelProps {
  element: TemplateElement<any, any>
  t: (key: string) => string
}

export function BackgroundRemovalPanel(props: BackgroundRemovalPanelProps) {
  const { t: tFromRegistry } = useTranslation()
  const t = props.t ?? tFromRegistry

  const clickedLayerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore)
  const currentLayer = clickedLayerStore?.getState()

  const { handleRemoveBackground } = useBackgroundRemoval()

  const imageLoading = useStore(ImageLoadingStore, state => state)
  const isRemoving = useMemo(() => {
    if (!currentLayer) return false
    const state = imageLoading[currentLayer._id]
    return Boolean(state?.isLoading)
  }, [imageLoading, currentLayer])

  const [selected, setSelected] = useState<string[]>(['surrounding'])

  const onApply = useCallback(
    async (type: string) => {
      if (isRemoving) return
      await handleRemoveBackground(type)
    },
    [isRemoving, handleRemoveBackground]
  )

  const isSupported = currentLayer?.type === ELayerType.IMAGE || currentLayer?.type === ELayerType.CHARM

  if (!isSupported) {
    return (
      <BlockStack gap="200">
        <Text as="p" variant="bodySm">
          {t('remove-background-is-only-available-for-image-elements')}
        </Text>
      </BlockStack>
    )
  }

  return (
    <BlockStack gap="200">
      <ChoiceList
        title={undefined}
        choices={[
          {
            label: t('remove-plain-white-background'),
            value: 'white',
            helpText: t('best-for-typography-or-ornamental-on-plain-white-background'),
          },
          {
            label: t('remove-solid-color-background'),
            value: 'solid',
            helpText: t('best-for-subjects-on-a-solid-color-background-across-the-frame'),
          },
          {
            label: t('remove-complex-background-with-ai'),
            value: 'ai',
            helpText: t('best-for-human-animal-portraits-on-a-complex-detailed-background'),
          },
        ]}
        selected={selected}
        onChange={setSelected}
        allowMultiple={false}
      />

      <Box paddingBlockStart="100" minWidth="100%">
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            loading={isRemoving}
            variant="secondary"
            onClick={() => onApply(selected[0] || 'surrounding')}
            disabled={isRemoving}
          >
            {isRemoving ? t('removing') : t('apply')}
          </Button>
        </div>
      </Box>
    </BlockStack>
  )
}
