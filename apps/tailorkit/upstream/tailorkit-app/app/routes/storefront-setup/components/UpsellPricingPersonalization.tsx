import { BlockStack, Button, Icon, InlineStack, Modal, Text, TextField } from '@shopify/polaris'
import { CheckCircleIcon, EditIcon } from '@shopify/polaris-icons'
import {
  isZeroDecimalCurrency,
  ZERO_DECIMAL_PRICE_MAP,
} from 'extensions/tailorkit-src/src/assets/utils/storefront-pricing'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppConfig } from '~/hooks/useAppConfig'
import { useTranslation } from 'react-i18next'
import { InstallAppEmbedActivator } from '~/components/InstallAppEmbedActivator'
import { ELink } from '~/constants/enum'
import { authenticatedFetch } from '~/shopify/fns.client'
import { openInNewTab } from '~/utils/openInNewTab'

interface UpsellPricingPersonalizationProps {
  appConfig: any
  currency?: string // e.g. "USD", "VND"
}

export default function UpsellPricingPersonalization(props: UpsellPricingPersonalizationProps) {
  const { t } = useTranslation()
  const { appConfig: shopAppConfig, currency = 'USD' } = props || {}

  // Centralised fetching of appConfig (replaces duplicated useEffect logic)
  const { appConfig, refetch: revalidate } = useAppConfig(shopAppConfig)

  /* --------------------------------------------------
   *  Local state for the Edit-price modal
   * -------------------------------------------------- */
  const [modalOpen, setModalOpen] = useState(false)
  const defaultAveragePrice = useMemo(() => {
    const code = currency?.toUpperCase?.() || 'USD'

    if (isZeroDecimalCurrency(code)) {
      const fallback = ZERO_DECIMAL_PRICE_MAP[code] ?? 1
      return fallback * 1000 // Quantity ≈ 1000 by default
    }

    return 10 // For decimal currencies
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
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        currencyDisplay: 'symbol',
      })
    } catch {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' })
    }
  }, [currency])

  const currencySymbol = useMemo(() => {
    const parts = currencyFormatter.formatToParts(0)
    const sym = parts.find(p => p.type === 'currency')?.value
    return sym || '$'
  }, [currencyFormatter])

  // Simple front-end estimation – server will calculate authoritative value
  const unitPrice = useMemo(() => {
    if (!averagePrice || isNaN(averagePrice)) return '0'

    const code = currency?.toUpperCase?.() || 'USD'

    if (isZeroDecimalCurrency(code)) {
      const fallback = ZERO_DECIMAL_PRICE_MAP[code] ?? 1
      const MAX_QTY = 99999
      const minUnitRequired = Math.ceil(averagePrice / MAX_QTY)

      if (minUnitRequired <= fallback) return fallback.toString()

      const exponent = Math.ceil(Math.log10(minUnitRequired))
      const unit = Math.pow(10, exponent)
      return unit.toString()
    }

    // Use power-of-ten steps 0.01,0.1,1,10...
    const exponent = Math.floor(Math.log10(averagePrice)) - 2
    let unit = Math.pow(10, exponent)
    if (unit < 0.01) unit = 0.01
    return unit.toFixed(2)
  }, [averagePrice, currency])

  const handleLearnMore = useCallback((learnMoreUrl: string) => {
    openInNewTab(learnMoreUrl)
  }, [])

  const handleEditPriceClick = useCallback(() => setModalOpen(true), [])

  const handleModalClose = useCallback(() => {
    if (saving) return // prevent closing while saving
    setModalOpen(false)
  }, [saving])

  const handleAverageChange = useCallback(
    (value: string) => {
      setPriceError(null)
      if (!value) {
        setAveragePrice(defaultAveragePrice)
        return
      }
      // Remove non-numeric characters except dot
      const sanitized = value.replace(/[^0-9.]/g, '')
      if (sanitized === '') {
        setAveragePrice(defaultAveragePrice)
      } else {
        setAveragePrice(Number(sanitized))
      }
    },
    [defaultAveragePrice]
  )

  /* --------------------------------------------------
   *  Price persistence & callback handling
   * -------------------------------------------------- */

  // Keep the last price the merchant saved. We’ll send this to the server once
  // the theme-extension is enabled.
  const [pendingAveragePrice, setPendingAveragePrice] = useState<number | null>(null)

  const handleSave = useCallback(async () => {
    if (!averagePrice || isNaN(averagePrice) || averagePrice <= 0) {
      setPriceError(t('enter-a-price-greater-than-zero'))
      return
    }
    setPriceError(null)

    // Store the price locally so we can push it right after the theme extension
    // is enabled.
    setPendingAveragePrice(averagePrice)

    // Close the modal and notify the merchant.
    setModalOpen(false)

    // If the extension is already enabled we can update immediately.
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

  // Callback supplied to InstallAppEmbedActivator → fires once the merchant has
  // enabled the theme extension. Only forward averagePrice when the merchant has
  // explicitly set one this session; otherwise the backend creates-if-missing without
  // touching an existing variant price the merchant may have edited in Shopify Admin.
  const handleThemeExtensionEnabled = useCallback(async () => {
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

  const features = useMemo(() => {
    return [
      {
        icon: <Icon source={CheckCircleIcon} />,
        title: t('upsell-pricing-to-boost-revenue'),
        learnMoreUrl: ELink.PERSONALIZED_UPSELL_PRICING_THUMBNAIL,
        description: (
          <InlineStack gap="100" align="start" blockAlign="center">
            <Text as="p" variant="bodyMd">
              {t('average-selling-price-description')}
            </Text>
            <Button variant="plain" icon={<Icon source={EditIcon} />} onClick={handleEditPriceClick}>
              {t('edit-price')}
            </Button>
          </InlineStack>
        ),
      },
      {
        icon: <Icon source={CheckCircleIcon} />,
        title: t('product-preview-in-cart'),
        learnMoreUrl: ELink.PERSONALIZED_PRODUCT_PREVIEW_IN_CART_YOUTUBE,
      },
    ]
  }, [handleEditPriceClick, t])

  return (
    <>
      <BlockStack gap="400">
        <InlineStack gap="300" align="start" blockAlign="center">
          <Text as="p" variant="bodyMd">
            {t('enable-tailorkit-theme-extension-to-enhance-your-store')}
          </Text>
        </InlineStack>

        {features.map((feature, index) => {
          return (
            <InlineStack key={index} gap="100" align="start" wrap={false}>
              <div>
                <s-box>{feature.icon}</s-box>
              </div>

              <BlockStack gap="200" align="start">
                <Text as="p" variant="bodyMd">
                  {feature.title}{' '}
                  <Button
                    variant="plain"
                    target="_blank"
                    textAlign="start"
                    onClick={() => handleLearnMore(feature.learnMoreUrl)}
                  >
                    {t('learn-more')}
                  </Button>
                </Text>
                {feature.description}
              </BlockStack>
            </InlineStack>
          )
        })}

        <InstallAppEmbedActivator
          appConfig={appConfig}
          revalidate={revalidate}
          onThemeExtensionEnabled={handleThemeExtensionEnabled}
          showDescription={false}
        />
      </BlockStack>

      {/* Edit price modal */}
      <Modal
        open={modalOpen}
        onClose={handleModalClose}
        title={t('edit-price')}
        primaryAction={{
          content: t('done'),
          onAction: handleSave,
          loading: saving,
        }}
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
    </>
  )
}
