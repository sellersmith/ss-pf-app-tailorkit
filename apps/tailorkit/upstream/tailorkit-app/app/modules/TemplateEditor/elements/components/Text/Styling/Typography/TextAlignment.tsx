import { Button, Tooltip } from '@shopify/polaris'
import { useCallback, useMemo } from 'react'
import { TEXT_ALIGNMENT_OPTIONS } from '~/constants/inspector/text'
import { useTranslation } from 'react-i18next'
import { FlexCenter } from '~/components/common/Flex'
import { useStore } from '~/libs/external-store'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import type { TLayerStore } from '~/stores/modules/layer'

export const TextAlignment = () => {
  const { t } = useTranslation()
  const layerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore) as TLayerStore | undefined
  const storeSettings = useStore(layerStore as TLayerStore, state => state?.settings || {})
  const currentValue = (storeSettings?.textAlign as string) || ''

  // Determine current alignment and corresponding icon
  const currentIndex = useMemo(
    () =>
      Math.max(
        0,
        TEXT_ALIGNMENT_OPTIONS.findIndex(option => option.value === currentValue)
      ),
    [currentValue]
  )
  const currentAlignment = useMemo(
    () => TEXT_ALIGNMENT_OPTIONS[currentIndex] ?? TEXT_ALIGNMENT_OPTIONS[0],
    [currentIndex]
  )

  const handleCycleAlignment = useCallback(() => {
    if (!layerStore) return
    const idx = TEXT_ALIGNMENT_OPTIONS.findIndex(option => option.value === currentValue)
    const nextIndex = ((idx >= 0 ? idx : -1) + 1) % TEXT_ALIGNMENT_OPTIONS.length
    const next = TEXT_ALIGNMENT_OPTIONS[nextIndex]

    layerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: { state: { settings: { ...storeSettings, textAlign: next.value } } },
    })
  }, [currentValue, layerStore, storeSettings])

  return (
    <Tooltip content={t('text-alignment')}>
      <FlexCenter>
        <Button fullWidth variant="tertiary" icon={currentAlignment.label} onClick={handleCycleAlignment} />
      </FlexCenter>
    </Tooltip>
  )
}
