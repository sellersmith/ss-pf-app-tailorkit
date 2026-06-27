import { BlockStack, Divider } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppConfig } from '~/hooks/useAppConfig'
import { useRootLoaderData } from '~/root'
import { useSaleToolsSaveBar } from '~/routes/storefront-setup/contexts/SaleToolsSaveBarContext'
import { authenticatedFetch } from '~/shopify/fns.client'
import { TOAST } from '~/constants/toasts'
import { showToast } from '~/utils/toastEvents'
import isEqual from 'lodash/isEqual'
import StorefrontStylingCard from './components/StorefrontStylingCard'
import PreviewModalCard from './components/PreviewModalCard'
import ProductPreviewInCartCard from './components/ProductPreviewInCartCard'
import PreviewZoomCard from './components/PreviewZoomCard'
import ConfirmationCheckboxCard, { DEFAULT_CONFIRMATION_MESSAGE } from './components/ConfirmationCheckboxCard'
import ColourGuideCard from './components/ColourGuideCard'
import EmojiPickerCard from './components/EmojiPickerCard'
import RedirectToCheckoutCard from './components/RedirectToCheckoutCard'

export default function StorefrontTab() {
  const { t } = useTranslation()
  const {
    shopData: { appConfig: shopAppConfig = {} },
  } = useRootLoaderData()

  const { appConfig, refetch: revalidate } = useAppConfig(shopAppConfig)
  const { setPendingChanges, setSaving, registerSaveHandler, registerDiscardHandler } = useSaleToolsSaveBar()

  const currentData = useMemo(() => appConfig?.appMetafields || {}, [appConfig])
  const [data, setData] = useState(currentData)
  const [saving, setSavingLocal] = useState(false)

  const isChanged = useMemo(() => !isEqual(data, currentData), [data, currentData])

  // Sync with context
  useEffect(() => {
    setPendingChanges(isChanged)
  }, [isChanged, setPendingChanges])

  useEffect(() => {
    setSaving(saving)
  }, [saving, setSaving])

  // Update local data when appConfig changes
  useEffect(() => {
    setData(currentData)
  }, [currentData])

  const handleSave = useCallback(async () => {
    try {
      setSavingLocal(true)
      showToast(t(TOAST.SETTINGS.SAVING))

      const res = await authenticatedFetch('/api/preferences', {
        method: 'POST',
        body: JSON.stringify({
          action: 'UPDATE_APP_METAFIELDS',
          appMetafields: data,
        }),
      })

      if (!res.success) {
        throw new Error(res.message)
      }

      await revalidate()
      showToast(t(TOAST.SETTINGS.SAVED))
    } catch (error) {
      console.error(error)
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
    } finally {
      setSavingLocal(false)
    }
  }, [data, revalidate, t])

  const handleDiscard = useCallback(() => {
    setData(currentData)
  }, [currentData])

  // Register handlers with context
  useEffect(() => {
    registerSaveHandler(handleSave)
    registerDiscardHandler(handleDiscard)
  }, [handleSave, handleDiscard, registerSaveHandler, registerDiscardHandler])

  return (
    <BlockStack gap="400">
      <StorefrontStylingCard />
      <Divider borderColor="border" />
      <PreviewModalCard
        isSaving={saving}
        value={data.modalPersonalizeDesign || { mobile: false, desktop: false }}
        onChange={modalPersonalizeDesign => setData({ ...data, modalPersonalizeDesign })}
      />
      <Divider borderColor="border" />
      <ProductPreviewInCartCard appConfig={appConfig} revalidate={revalidate} />
      <Divider borderColor="border" />
      <PreviewZoomCard
        isSaving={saving}
        value={data.previewZoom || { enabled: true, showIndicator: false }}
        onChange={previewZoom => setData({ ...data, previewZoom })}
      />
      <Divider borderColor="border" />
      <ConfirmationCheckboxCard
        isSaving={saving}
        value={data.confirmationCheckbox || { enabled: false, message: DEFAULT_CONFIRMATION_MESSAGE }}
        onChange={confirmationCheckbox => setData({ ...data, confirmationCheckbox })}
      />
      <Divider borderColor="border" />
      <RedirectToCheckoutCard
        isSaving={saving}
        value={data.redirectToCheckoutAfterAtc || { enabled: false }}
        onChange={redirectToCheckoutAfterAtc => setData({ ...data, redirectToCheckoutAfterAtc })}
      />
      <Divider borderColor="border" />
      <ColourGuideCard
        isSaving={saving}
        value={data.colourGuide || { defaultImageUrl: '' }}
        onChange={colourGuide => setData({ ...data, colourGuide })}
      />
      <Divider borderColor="border" />
      <EmojiPickerCard
        isSaving={saving}
        value={data.allowedEmojis || {}}
        onChange={allowedEmojis => setData({ ...data, allowedEmojis })}
      />
    </BlockStack>
  )
}
