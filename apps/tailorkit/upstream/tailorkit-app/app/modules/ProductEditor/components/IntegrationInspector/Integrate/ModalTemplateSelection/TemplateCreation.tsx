import { useParams, useSearchParams } from '@remix-run/react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { openIDBDatabase, storeJSONFileToIDB } from '~/bootstrap/db/index-db'
import { IDB_DATABASE_NAME, IDB_STORE_NAME } from '~/constants/index-db'
import useSaveIntegration from '~/modules/ProductEditor/hooks/useSaveIntegration'
import { DEFAULT_TEMPLATE_DIMENSION } from '~/stores/modules/template'
import { uuid } from '~/utils/uuid'
import { navigateToTemplateMaxModal } from './fns'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { EVENTS_TRACKING } from '~/bootstrap/constants/eventsTracking'
import { computePreviewProductImageFromLayer } from './previewPlacement'
import type { TViewLayerIntegrationStore } from '~/stores/modules/integration/viewLayerIntegration'
import { Button } from '@shopify/polaris'
import { PlusIcon } from '@shopify/polaris-icons'
import useDevices from '~/utils/hooks/useDevice'

export interface IModalTemplateSelectionProps {
  templateConfig?: {
    name?: string
    width?: number
    height?: number
  }
  printAreaId: string
  previewSeed?: { src: string; altText?: string } | null
  productImageDimension?: { width?: number; height?: number } | null
  layerStore: TViewLayerIntegrationStore
}

export function TemplateCreation(props: IModalTemplateSelectionProps) {
  const { templateConfig, printAreaId, previewSeed, productImageDimension, layerStore } = props
  const { t } = useTranslation()
  const { isSmallMobileView } = useDevices()
  const [saving, setSaving] = useState(false)

  const { saveTemporaryIntegration } = useSaveIntegration()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const { trackEvent } = useEventsTracking()

  const onNavigate = useCallback(async () => {
    try {
      setSaving(true)
      const mockupId = searchParams.get('mockup') || ''

      if (!mockupId) {
        throw new Error('Mockup ID is required')
      }

      await saveTemporaryIntegration(mockupId)

      // Store the template to the database
      const id = uuid()
      const templateTitle = templateConfig?.name || t('untitled')

      const dimension = {
        ...DEFAULT_TEMPLATE_DIMENSION,
        ...(templateConfig
          ? { width: Math.round(templateConfig?.width || 0), height: Math.round(templateConfig?.height || 0) }
          : {}),
      }

      const storeName = IDB_STORE_NAME.TEMPLATE_DIMENSION

      const formData: any = {
        title: templateTitle,
        ...dimension,
      }

      if (previewSeed) {
        formData.previewProductImage = computePreviewProductImageFromLayer({
          previewSeed,
          layerStore,
          productImageDimension,
          canvas: { width: dimension.width || 0, height: dimension.height || 0 },
          skipLayerStoreCalculations: true, // Skip because we're creating a NEW blank template
        })
      }

      trackEvent(EVENTS_TRACKING.CREATE_TEMPLATE_FROM_PERSONALIZED_PRODUCT, formData)

      const db = await openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_DIMENSION, storeName)
      await storeJSONFileToIDB(db, storeName, formData, id)

      // Navigate to the template creation page in the max modal
      navigateToTemplateMaxModal(searchParams, params, id, printAreaId, false)
    } catch (error) {
      console.error(error)
      showGenericErrorToast()
    } finally {
      setSaving(false)
    }
  }, [
    layerStore,
    params,
    previewSeed,
    printAreaId,
    productImageDimension,
    saveTemporaryIntegration,
    searchParams,
    t,
    templateConfig,
    trackEvent,
  ])

  return (
    <Button variant="primary" loading={saving} icon={PlusIcon} onClick={onNavigate}>
      {isSmallMobileView ? t('create') : t('create-template')}
    </Button>
  )
}
