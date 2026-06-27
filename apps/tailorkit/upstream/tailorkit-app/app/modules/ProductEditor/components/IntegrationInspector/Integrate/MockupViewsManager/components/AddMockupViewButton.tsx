import { Button } from '@shopify/polaris'
import { PlusIcon } from '@shopify/polaris-icons'
import isArray from 'lodash/isArray'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import withTooltip from '~/bootstrap/hoc/withTooltip'
import { useStore } from '~/libs/external-store'
import type { WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import withMockup from '~/modules/ProductEditor/withMockup'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { uuid } from '~/utils/uuid'

interface IAddMockupViewButtonProps extends WithVariantsProps {
  onAfterAddView: (viewId: string) => void
}
const TooltipButton = withTooltip(Button)

function AddMockupViewButton(props: IAddMockupViewButtonProps) {
  const { variants, mockupId, onAfterAddView } = props
  const { t } = useTranslation()

  const mockup = variants[0].mockup as any
  const rawViews = useStore(IntegrationStore, s => s.variants.find(v => v.mockup._id === mockupId)?.mockup?.views)
  const selectedViewId = useStore(
    IntegrationStore,
    s => s.variants.find(v => v.mockup._id === mockupId)?.mockup?.selectedViewId
  )
  const views = useMemo(() => (isArray(rawViews) ? rawViews : []), [rawViews])

  const isDisabledAddView = useMemo(() => views.length >= 5, [views])
  const onAddView = () => {
    const newViewId = uuid()
    const allLayerIds = (mockup.layers || []).map((ls: any) => ls.getState()._id)

    // Prefer cloning from currently selected view (fallback to first view, then to all layers)
    const sourceView = views.find(v => v._id === selectedViewId)

    const isSourceViewLayersValid = isArray(sourceView?.layers) && sourceView.layers.length > 0
    const clonedLayers = isSourceViewLayersValid ? [...sourceView.layers] : allLayerIds

    // Build new view payload, cloning common properties if available
    const newView: Record<string, unknown> = {
      _id: newViewId,
      title: `View ${views.length + 1}`,
      layers: clonedLayers,
    }

    if (sourceView) {
      if (typeof sourceView.enableClippingMask === 'boolean') newView.enableClippingMask = sourceView.enableClippingMask
      if (sourceView.overrides) newView.overrides = { ...sourceView.overrides }
      if (sourceView.baseImage) newView.baseImage = sourceView.baseImage
      if (sourceView.backgroundImage) newView.backgroundImage = sourceView.backgroundImage
      if (sourceView.maskImage) newView.maskImage = sourceView.maskImage
    }

    IntegrationStore.dispatch({
      type: 'CREATE_VIEW',
      payload: { mockupId, view: newView as any },
    })
    onAfterAddView(newViewId)
  }

  return (
    <TooltipButton
      variant="primary"
      fullWidth
      onClick={onAddView}
      icon={PlusIcon}
      disabled={isDisabledAddView}
      tooltipEnabled={true}
      tooltipContent={
        isDisabledAddView
          ? t('you-ve-reached-5-mockup-views-and-can-t-create-more')
          : t('add-another-view-to-display-the-design-on-a-different-angle-e-g-back-side')
      }
      tooltipProps={{ preferredPosition: 'above' }}
    >
      {t('add-view')}
    </TooltipButton>
  )
}

export default withMockup(AddMockupViewButton)
