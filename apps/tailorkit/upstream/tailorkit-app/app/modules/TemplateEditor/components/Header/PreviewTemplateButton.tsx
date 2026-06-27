import { Button, Icon } from '@shopify/polaris'
import { ViewIcon } from '@shopify/polaris-icons'
import { Fragment, useCallback, useMemo, useState } from 'react'
import { useSearchParams } from '@remix-run/react'
import type { TLayerStore } from '~/stores/modules/layer'
import { clearAllSelectedLayerStores, LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import useDevices from '~/utils/hooks/useDevice'
import { uploadedPreviewStoreActions } from '../Preview/stores/uploadedPreviewStore'
import { EVENTS_PARAMETERS_NAME, EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'

let clickedLayerStoreBackup: TLayerStore | null | undefined = null

/**
 * Get the clicked layer store backup
 *
 * @returns {TLayerStore | null | undefined}
 */
export function getClickedLayerStoreBackup() {
  return clickedLayerStoreBackup
}

/**
 * Clear the clicked layer store backup
 */
export function clearClickedLayerStoreBackup() {
  clickedLayerStoreBackup = null
}

export function PreviewTemplateButton(props: any) {
  const { t } = props
  const { cacheOptionSet } = uploadedPreviewStoreActions
  const [searchParams, setSearchParams] = useSearchParams()

  const extractedLayerStores = useStore(TemplateEditorStore, state => state.extractedLayerStores)
  const clickedLayerStore = useStore(LayerStoreSelection, state => state.clickedLayerStore)

  const { isMobileView } = useDevices()
  const [isPreparingPreview, setIsPreparingPreview] = useState(false)
  const { trackEvent } = useEventsTracking()

  const cacheRootOptionItemsOfLayers = useCallback(() => {
    extractedLayerStores?.forEach(layerStore => {
      const { _id, optionSet } = layerStore.getState()
      if (optionSet) {
        cacheOptionSet(_id, optionSet)
      }
    })
  }, [cacheOptionSet, extractedLayerStores])

  const handlePreview = useCallback(() => {
    setIsPreparingPreview(true)

    // Backup the clicked layer store
    clickedLayerStoreBackup = clickedLayerStore

    // Clear all selected layers
    clearAllSelectedLayerStores()

    // Cache root option items of all layers
    cacheRootOptionItemsOfLayers()

    // Set preview mode via URL
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('previewMode', 'true')
    setSearchParams(nextParams)

    setIsPreparingPreview(false)
    trackEvent(EVENTS_TRACKING.VIEW_PREVIEW_TEMPLATE, {
      [EVENTS_PARAMETERS_NAME.TYPE]: 'preview_template_from_template_editor',
    })
  }, [cacheRootOptionItemsOfLayers, clickedLayerStore, trackEvent, searchParams, setSearchParams])

  const buttonProps = useMemo(() => {
    return {
      id: 'preview-template-btn',
      onClick: handlePreview,
      disabled: extractedLayerStores?.length <= 0,
      loading: isPreparingPreview,
      icon: <Icon source={ViewIcon} tone="base" />,
    }
  }, [extractedLayerStores, handlePreview, isPreparingPreview])

  return (
    <Fragment>{isMobileView ? <Button {...buttonProps} /> : <Button {...buttonProps}>{t('preview')}</Button>}</Fragment>
  )
}
