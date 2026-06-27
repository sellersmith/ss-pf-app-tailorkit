import { Button, Tooltip } from '@shopify/polaris'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FlexCenter } from '~/components/common/Flex'
import { TEXT_STYLE_OPTIONS } from '~/constants/inspector/text'
import { useStore } from '~/libs/external-store'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import type { TLayerStore } from '~/stores/modules/layer'

export const TextStyleItalic = () => {
  const { t } = useTranslation()
  const layerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore) as TLayerStore | undefined
  const storeSettings = useStore(layerStore as TLayerStore, state => state?.settings || {})
  const textStyle = useMemo(
    () => (Array.isArray(storeSettings?.textStyle) ? (storeSettings.textStyle as string[]) : []),
    [storeSettings?.textStyle]
  )
  const isActive = textStyle.includes('italic')
  const icon = TEXT_STYLE_OPTIONS.find(opt => opt.value === 'italic')?.label

  const onToggle = useCallback(() => {
    if (!layerStore) return
    const next = isActive ? textStyle.filter(s => s !== 'italic') : [...textStyle, 'italic']
    layerStore.dispatch({
      type: 'UPDATE_LAYER',
      payload: { state: { settings: { ...storeSettings, textStyle: next } } },
    })
  }, [isActive, layerStore, storeSettings, textStyle])

  return (
    <Tooltip content={t('italic')}>
      <FlexCenter>
        <Button variant={isActive ? 'secondary' : 'tertiary'} icon={icon} fullWidth onClick={onToggle} />
      </FlexCenter>
    </Tooltip>
  )
}
