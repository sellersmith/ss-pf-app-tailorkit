import { Button, Text, Tooltip } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useInspectorPanel } from '../../../../common/StylingInspector/useInspectorPanel'
import { useStore } from '~/libs/external-store'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import type { TLayerStore } from '~/stores/modules/layer'

export const FontFamily = () => {
  const { t } = useTranslation()
  const layerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore) as TLayerStore | undefined
  const family = useStore(layerStore as TLayerStore, state => state?.settings?.fontFamily?.family || '')

  // const [fontDisplay, setFontDisplay] = useState(family)

  // Inspector panel handles state; keep activator simple
  // useEffect(() => {
  //   ;(async () => {
  //     if (!src) return

  //     const fontSVG = await convertFontFileToSVG(src, family, {
  //       fontSize: 12,
  //       style: 'width: 100%; height: 100%',
  //     })

  //     setFontDisplay(fontSVG)
  //   })()
  // }, [family, src])

  // Simple hook - content is rendered fresh by registry using element state!
  const { openInspector: handleOpenInspector } = useInspectorPanel('font-family', t('font-family'))

  return (
    <div className="Polaris-ButtonGroup_" style={{ fontFamily: `${family}` }}>
      <Tooltip content={t('font-family')}>
        <Button disclosure="select" textAlign="start" onClick={handleOpenInspector}>
          {/* @ts-expect-error -- Polaris Button types don't allow children alongside disclosure prop */}
          <div style={{ maxWidth: '52px' }}>
            <Text as="span" variant="bodyMd" truncate>
              {family || '--'}
            </Text>
          </div>
        </Button>
      </Tooltip>
    </div>
  )
}
