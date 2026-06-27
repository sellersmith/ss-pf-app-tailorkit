import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Switch from '~/components/common/Switch'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import type { WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'

interface IClippingMaskEnablerProps extends WithVariantsProps {
  viewId?: string
}

export default function ClippingMaskEnabler(props: IClippingMaskEnablerProps) {
  const { variants, mockupId, viewId } = props
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()

  const firstVariant = useMemo(() => variants[0], [variants])
  const mockup = useMemo(() => firstVariant.mockup, [firstVariant.mockup])
  const enableClippingMask = useMemo(() => {
    const view = (mockup.views || []).find((v: any) => v._id === viewId)
    return Boolean(view?.enableClippingMask)
  }, [mockup.views, viewId])

  const onChangeEnableClippingMask = (value: boolean) => {
    if (!viewId) return
    IntegrationStore.dispatch({
      type: 'UPDATE_VIEW_ASSETS',
      payload: { mockupId, viewId, enableClippingMask: value },
    })

    // Send event to MixPanel
    trackEvent(EVENTS_TRACKING.TOGGLE_CLIPPING_MASK, {
      [EVENTS_PARAMETERS_NAME.NEW_VALUE]: value ? 'enabled' : 'disabled',
    })

    // If there is no layer selected, automatically select the first template layer
    setTimeout(() => {
      if (!LayerIntegrationStoreSelection.getState().clickedLayerStore) {
        LayerIntegrationStoreSelection.dispatch({
          type: 'SET_LAYER_STORE_SELECTION',
          payload: {
            clickedLayerStore: IntegrationStore.getState().variants[0].mockup.layers.find(
              (layer: any) => layer.getState().type === 'template'
            ),
          },
        })
      }
    }, 10)
  }
  return (
    <div id="integration-enable-clipping-mask">
      <s-stack gap="small-200" direction="block">
        {/* <s-text type="strong">{t('clipping-mask')}</s-text> */}
        <Switch
          label={t('enable-clipping-mask-for-templates')}
          accessibilityLabel={t('enable-clipping-mask-for-templates')}
          checked={enableClippingMask}
          onInput={() => {
            onChangeEnableClippingMask(!enableClippingMask)
          }}
        />
      </s-stack>
    </div>
  )
}
