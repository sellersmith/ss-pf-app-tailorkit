import { Button, Icon, InlineStack, Tooltip } from '@shopify/polaris'
import { AlertTriangleIcon, HideIcon, ViewIcon } from '@shopify/polaris-icons'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRootLoaderData } from '~/root'
import { SHOPIFY_API_ACTIONS } from '~/routes/api.shopify/constants'
import { getIdNumberFromIdString } from '~/shopify/fns'
import { authenticatedFetch } from '~/shopify/fns.client'
import { IntegrationStatus } from '~/types/integration'
import useDevices from '~/utils/hooks/useDevice'

interface RowActionsProps {
  product: any
  isAnyTemplateUpdated: boolean
}

export default function RowActions({ product, isAnyTemplateUpdated }: RowActionsProps) {
  const { t } = useTranslation()
  const { isMobileView, isMobile, isIOS } = useDevices()

  const {
    status,
    denormalizedData: { variants },
  } = product

  const [preparing, setPreparing] = useState(false)
  const isPublished = status.toLowerCase() === IntegrationStatus.PUBLISHED
  const { shopData: { shopDomain } = {} } = useRootLoaderData() || {}

  // Handle preview
  const openPreview = useCallback(
    async (e?: any) => {
      if (e) {
        e.stopPropagation()
      }

      // Detect publishing state
      let preOpenedTab: WindowProxy | null = null
      // Pre-open a blank tab synchronously to avoid mobile popup blockers
      // Only do this on mobile view
      if (isMobile || isIOS) {
        preOpenedTab = window.open('', '_blank')
      }

      setPreparing(true)

      try {
        const previewable = isPublished

        if (previewable) {
          const shopifyProduct = await authenticatedFetch(
            `/api/shopify?action=${SHOPIFY_API_ACTIONS.GET_PRODUCTS}&ids=${getIdNumberFromIdString(variants[0].productId)}`
          ).catch(console.error)

          const handle = shopifyProduct?.[0]?.handle
          const isActive = shopifyProduct?.[0]?.status === 'ACTIVE'

          if (isActive && handle) {
            const url = `https://${shopDomain}/products/${handle}?v=${getIdNumberFromIdString(variants[0].id)}`

            if (preOpenedTab) {
              preOpenedTab.location.href = url
            } else {
              // Fallback if the pre-open failed
              window.open(url, '_blank')
            }

            return
          }
        }

        // Close the pre-opened tab if we cannot navigate (not published/active)
        if (preOpenedTab) preOpenedTab.close()
      } finally {
        setPreparing(false)
      }
    },
    [isIOS, isMobile, isPublished, shopDomain, variants]
  )

  return (
    <InlineStack gap="200" align="end" blockAlign="center" wrap={false}>
      {isAnyTemplateUpdated && (
        <Tooltip content={t('template-updated-republish-to-show-on-storefront')}>
          <Icon source={AlertTriangleIcon} tone="caution" />
        </Tooltip>
      )}
      <div style={{ marginTop: isMobileView ? '0px' : '6px' }}>
        <Tooltip content={isPublished ? t('view-on-storefront') : t('publish-to-view-on-storefront')}>
          <Button
            size="slim"
            variant={isMobileView ? 'secondary' : 'plain'}
            loading={preparing}
            disabled={preparing || !isPublished}
            onClick={openPreview}
            icon={isPublished ? ViewIcon : HideIcon}
            accessibilityLabel={isPublished ? t('view-on-storefront') : t('publish-to-view-on-storefront')}
          />
        </Tooltip>
      </div>
    </InlineStack>
  )
}
