import { BlockStack, Button, Card, InlineStack, Modal, Text, TextField } from '@shopify/polaris'
import { EditIcon } from '@shopify/polaris-icons'
import {
  isZeroDecimalCurrency,
  ZERO_DECIMAL_PRICE_MAP,
} from 'extensions/tailorkit-src/src/assets/utils/storefront-pricing'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppConfig } from '~/hooks/useAppConfig'
import { InstallAppEmbedActivator } from '~/components/InstallAppEmbedActivator'
import { authenticatedFetch } from '~/shopify/fns.client'
import SettingLayout from '~/routes/settings/components/SettingLayout'
import VideoLearnMoreModal from '~/routes/storefront-setup/components/VideoLearnMoreModal'

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=XI9qLnBoffQ'

interface UpsellPricingCardProps {
  appConfig: any
  currency?: string
}

export default function UpsellPricingCard({ appConfig: shopAppConfig, currency = 'USD' }: UpsellPricingCardProps) {
  const { t } = useTranslation()
  const { appConfig, refetch: revalidate } = useAppConfig(shopAppConfig)

  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const toggleVideoModal = useCallback(() => setVideoModalOpen(prev => !prev), [])

  const [modalOpen, setModalOpen] = useState(false)
  const defaultAveragePrice = useMemo(() => {
    const code = currency?.toUpperCase?.() || 'USD'
    if (isZeroDecimalCurrency(code)) {
      const fallback = ZERO_DECIMAL_PRICE_MAP[code] ?? 1
      return fallback * 1000
    }
    return 10
  }, [currency])

  const [averagePrice, setAveragePrice] = useState<number>(defaultAveragePrice)
  const [saving, setSaving] = useState(false)
  const [priceError, setPriceError] = useState<string | null>(null)

  // Preload previously-saved averagePrice so the modal reflects merchant intent across sessions.
  // Without this, the input would always reset to defaultAveragePrice, leading merchants to
  // think their saved value was lost.
  const savedAveragePrice: number | undefined = appConfig?.optionPricing?.averagePrice
  useEffect(() => {
    if (typeof savedAveragePrice === 'number' && !isNaN(savedAveragePrice) && savedAveragePrice > 0) {
      setAveragePrice(savedAveragePrice)
    }
  }, [savedAveragePrice])

  const currencyFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency, currencyDisplay: 'symbol' })
    } catch {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })
    }
  }, [currency])

  const currencySymbol = useMemo(() => {
    const parts = currencyFormatter.formatToParts(0)
    return parts.find(p => p.type === 'currency')?.value || '$'
  }, [currencyFormatter])

  const unitPrice = useMemo(() => {
    if (!averagePrice || isNaN(averagePrice)) return '0'
    const code = currency?.toUpperCase?.() || 'USD'
    if (isZeroDecimalCurrency(code)) {
      const fallback = ZERO_DECIMAL_PRICE_MAP[code] ?? 1
      const MAX_QTY = 99999
      const minUnitRequired = Math.ceil(averagePrice / MAX_QTY)
      if (minUnitRequired <= fallback) return fallback.toString()
      const exponent = Math.ceil(Math.log10(minUnitRequired))
      return Math.pow(10, exponent).toString()
    }
    const exponent = Math.floor(Math.log10(averagePrice)) - 2
    let unit = Math.pow(10, exponent)
    if (unit < 0.01) unit = 0.01
    return unit.toFixed(2)
  }, [averagePrice, currency])

  const handleEditPriceClick = useCallback(() => setModalOpen(true), [])

  const handleModalClose = useCallback(() => {
    if (saving) return
    setModalOpen(false)
  }, [saving])

  const handleAverageChange = useCallback(
    (value: string) => {
      setPriceError(null)
      if (!value) {
        setAveragePrice(defaultAveragePrice)
        return
      }
      const sanitized = value.replace(/[^0-9.]/g, '')
      setAveragePrice(sanitized === '' ? defaultAveragePrice : Number(sanitized))
    },
    [defaultAveragePrice]
  )

  const [pendingAveragePrice, setPendingAveragePrice] = useState<number | null>(null)

  const handleSave = useCallback(async () => {
    if (!averagePrice || isNaN(averagePrice) || averagePrice <= 0) {
      setPriceError(t('enter-a-price-greater-than-zero'))
      return
    }
    setPriceError(null)
    setPendingAveragePrice(averagePrice)
    setModalOpen(false)
    if (appConfig?.enabledAppEmbed) {
      try {
        setSaving(true)
        await authenticatedFetch('/api/option-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ENSURE_PRICING_PRODUCT', averagePrice }),
        })
        revalidate()
      } catch (err) {
        console.error('Failed to save average price', err)
      } finally {
        setSaving(false)
      }
    }
  }, [averagePrice, appConfig?.enabledAppEmbed, revalidate, t])

  const handleThemeExtensionEnabled = useCallback(async () => {
    // Only push averagePrice if the merchant explicitly set one during this session.
    // Sending a default value here would clobber a price the merchant may have edited
    // directly in Shopify Admin on the UNLISTED "Personalization Price" product.
    const body: { action: string; averagePrice?: number } = { action: 'ENSURE_PRICING_PRODUCT' }
    if (
      pendingAveragePrice !== null
      && pendingAveragePrice !== undefined
      && !isNaN(pendingAveragePrice)
      && pendingAveragePrice > 0
    ) {
      body.averagePrice = pendingAveragePrice
    }
    try {
      await authenticatedFetch('/api/option-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      revalidate()
    } catch (err) {
      console.error('Failed to create pricing product after extension enabled', err)
    }
  }, [pendingAveragePrice, revalidate])

  return (
    <SettingLayout title={t('upsell-pricing')}>
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('enable-theme-extension-to-unlock-this-feature')}{' '}
            <Button variant="plain" onClick={toggleVideoModal}>
              {t('learn-more')}
            </Button>
          </Text>
          <Text as="p" variant="bodyMd" tone="subdued">
            {t(
              'A Personalization Price product will be auto-created in your store to enable upsell pricing.'
                + ' Its price is based on an average to keep upsell pricing accurate across markets.'
            )}
          </Text>
          <InlineStack gap="300" align="end" blockAlign="center">
            <Button variant="plain" icon={EditIcon} onClick={handleEditPriceClick}>
              {t('edit-price')}
            </Button>
            <InstallAppEmbedActivator
              appConfig={appConfig}
              revalidate={revalidate}
              onThemeExtensionEnabled={handleThemeExtensionEnabled}
              showDescription={false}
            />
          </InlineStack>
        </BlockStack>
      </Card>

      <VideoLearnMoreModal youtubeUrl={YOUTUBE_URL} open={videoModalOpen} onClose={toggleVideoModal} />

      <Modal
        open={modalOpen}
        onClose={handleModalClose}
        title={t('edit-price')}
        primaryAction={{ content: t('done'), onAction: handleSave, loading: saving }}
        secondaryActions={[{ content: t('cancel'), onAction: handleModalClose }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd">
              {t('enter-average-selling-price')}
            </Text>
            <TextField
              label={t('average-price')}
              prefix={currencySymbol}
              value={averagePrice.toString()}
              type="number"
              onChange={handleAverageChange}
              error={priceError || undefined}
              autoComplete="off"
            />
            <TextField
              label={t('personalization-pricing-unit')}
              prefix={currencySymbol}
              value={unitPrice}
              disabled
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </SettingLayout>
  )
}
