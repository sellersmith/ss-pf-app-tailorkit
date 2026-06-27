import { Badge, BlockStack, Box, Button, Card, InlineStack, Link, List, Text, Thumbnail } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { type FulfillmentOrderStatus, type EPROVIDER } from '~/constants/fulfillment-providers'
import type { LineItem } from '~/models/Order.server'
import { getOptionPropertiesForPrintArea } from '~/routes/api.public.print-image-generation/fns'
import { openInNewTab } from '~/utils/openInNewTab'
import { OrderFulfillActions } from './OrderFulfillActions'
import { FulfillmentOrderStatusBadge } from './OrderStateBadge'
import PreviewPrintImage from './PreviewPrintImage'
import FulfillmentOrderStatusComponent from './FulfillmentOrderStatus'
import BannerOrderInformation from './BannerOrderInformation'
import { CommonError } from '~/constants/errors'
import { groupCharmLineItems } from '~/utils/charm-line-item-grouping'
import { groupBulkLineItems } from '~/utils/bulk-line-item-grouping'
import { CharmNestedRow } from './CharmNestedRow'
import BulkOrderGroupBanner from './BulkOrderGroupBanner'
import type { DisplayFulfillmentStatus } from '~/models/Order.d'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { useCallback, useMemo, useState } from 'react'
import { formatOptionDisplayPricing } from '~/utils/exchange-rates/client'
import { PRINT_ID_PREFIX } from 'extensions/tailorkit-src/src/assets/constants'
import { SaveIcon, ViewIcon } from '@shopify/polaris-icons'
import { FeatureRestrict } from '~/routes/pricing._index/components/FeatureRestrict/FeatureRestrict'
import { FEATURE_TO_PLAN_MAP } from '~/routes/api.pricing/constants/featurePlans'

/** Check if a string contains Private Use Area (PUA) characters used by custom emoji fonts */
function containsPUAChars(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code >= 0xe000 && code <= 0xf8ff) return true
  }
  return false
}

/** Replace PUA characters with ★ (mirrors storefront sanitization) */
function sanitizePUAChars(text: string): string {
  return text.replace(/[\uE000-\uF8FF]/gu, '★')
}

interface EmojiFont {
  family: string
  src: string
}
interface VariantTemplateWithEmoji {
  printAreas?: Array<{
    template?: {
      layers?: Array<{
        settings?: { emojiPicker?: { font?: EmojiFont } }
      }>
    }
  }>
}

/** Loaded font families cache to avoid duplicate FontFace loads */
const loadedEmojiFonts = new Set<string>()

/**
 * Extract emoji font from template layers and load via FontFace API.
 * Caches loaded fonts to prevent duplicate loads across line items.
 */
function loadEmojiFontsFromTemplate(variantTemplate: VariantTemplateWithEmoji | null | undefined): string | null {
  if (!variantTemplate?.printAreas) return null
  for (const pa of variantTemplate.printAreas) {
    for (const layer of pa?.template?.layers || []) {
      const font = layer?.settings?.emojiPicker?.font
      if (font?.family && font?.src) {
        if (!loadedEmojiFonts.has(font.family)) {
          loadedEmojiFonts.add(font.family)
          const face = new FontFace(font.family, `url(${font.src})`)
          face
            .load()
            .then(loaded => document.fonts.add(loaded))
            .catch(err => console.error(`Failed to load emoji font ${font.family}:`, err))
        }
        return font.family
      }
    }
  }
  return null
}

interface IOrderDetailCardProps {
  shopData: any
  shopId?: string
  vendor: EPROVIDER
  status: FulfillmentOrderStatus | DisplayFulfillmentStatus
  order: any
  fulfillmentOrder?: any
  line_items: LineItem[]
  fulfillmentOrderId?: string
  PROPERTY_PREFIX: string
  requestingFulfillment: boolean
  handle: string
  openPreviewPrintImageModal: (id: string) => any
  onRequestFulfillment: (orderId: number, vendor: string) => Promise<void>
  openOrderDetail: () => void
  onOpenFulfillmentOrder: (fulfillmentOrderId: string, shopId: string, vendor: EPROVIDER) => Promise<void>
}

function OrderDetailCard(props: IOrderDetailCardProps) {
  const {
    shopData,
    shopId,
    vendor,
    order,
    fulfillmentOrder,
    line_items,
    PROPERTY_PREFIX,
    fulfillmentOrderId,
    requestingFulfillment,
    openPreviewPrintImageModal,
    onRequestFulfillment,
    openOrderDetail,
    onOpenFulfillmentOrder,
  } = props

  const { t } = useTranslation()

  // Feature access check for SVG export
  const plan = shopData?.subscription?.plan
  const canExportSvg = plan?.usages?.orders?.length > 0 ? plan?.features?.losslessSvgExport === true : true
  const svgRequiredPlan = FEATURE_TO_PLAN_MAP.losslessSvgExport?.[0] || null

  const { groupedItems } = useMemo(
    () => groupCharmLineItems(line_items, PROPERTY_PREFIX),
    [line_items, PROPERTY_PREFIX]
  )

  // Legacy support: bulk-personalize-v2 was live on master 2026-05-19 → 2026-05-21
  // (46h window). Orders placed during that window carry `_TLK_bulk_group`
  // line-item properties. groupBulkLineItems returns an empty array for
  // post-revert orders, so the banner below is a no-op for them.
  const bulkGroups = useMemo(() => groupBulkLineItems(line_items).groups, [line_items])

  const [modalOpen, setModalOpen] = useState(false)

  const onOpenPrintPreviewModal = useCallback(
    (id: string) => {
      setModalOpen(true)
      openPreviewPrintImageModal(id)
    },
    [openPreviewPrintImageModal]
  )

  const renderBannerOrderInformation = () => {
    if (!fulfillmentOrder) return null

    const { merchantRequests } = fulfillmentOrder
    const { requestStatus } = fulfillmentOrder

    const isRejected = requestStatus === 'REJECTED'
    const firstMerchantRequests = merchantRequests[0]

    if (!isRejected) return null

    return <BannerOrderInformation tone="warning" message={firstMerchantRequests?.message || CommonError} />
  }

  return (
    <Card key={vendor}>
      <BlockStack gap="200">
        <InlineStack align="space-between">
          <InlineStack gap={'200'} blockAlign="center">
            <Text as="p" variant="bodyMd" fontWeight="semibold">
              {vendor}
            </Text>
            {fulfillmentOrder && <FulfillmentOrderStatusComponent fulfillmentOrder={fulfillmentOrder} />}
          </InlineStack>

          {fulfillmentOrder ? (
            <FulfillmentOrderStatusBadge
              status={fulfillmentOrder.status}
              requestStatus={fulfillmentOrder.requestStatus}
            />
          ) : null}
        </InlineStack>

        {/* Render banner order information */}
        {renderBannerOrderInformation()}

        {/* Legacy bulk personalize grouping banner — only renders for orders
            placed during the 2026-05-19 → 2026-05-21 v2 window. No-op otherwise. */}
        <BulkOrderGroupBanner groups={bulkGroups} />

        <BlockStack gap={'300'}>
          {groupedItems.map(({ item, charms }) => {
            const {
              id,
              product,
              variant_id,
              current_quantity,
              variant_title,
              // fulfillment_status,
              integration,
              price_set: { presentment_money },
              properties,
              print_images,
            } = item

            // Get product data
            const variant = product?.variants.find((variant: any) => variant.id.indexOf(variant_id) > -1)
            const title = product?.title
            const image = (variant?.image || product?.featuredImage)?.url

            // Get template data
            const { variants } = integration || {}
            const variantTemplate = variants
              ? variants.flat().find((variant: any) => {
                  return variant.id.indexOf(variant_id) > -1
                })
              : null

            // Group print options by print area and option set
            const { printAreaIds, groupedOptions, propertiesGroupedByPrintAreas } = getOptionPropertiesForPrintArea({
              integration,
              PROPERTY_PREFIX,
              properties,
              variantId: variant_id,
            })

            // Load custom emoji fonts so PUA characters render correctly in property values
            const emojiFontFamily = loadEmojiFontsFromTemplate(variantTemplate)

            // Build map: sanitized ★ text → original PUA text from hidden _TK properties
            // Match by comparing sanitized(PUA content) with visible prop.value
            const originalPUAByStarText: Record<string, string> = {}
            if (emojiFontFamily) {
              for (const p of properties || []) {
                const name = typeof p?.name === 'string' ? p.name : ''
                if (!name.startsWith('_')) continue
                try {
                  const parsed = typeof p.value === 'string' ? JSON.parse(p.value) : p.value
                  const content = parsed?.settings?.content
                  if (content && typeof content === 'string' && containsPUAChars(content)) {
                    // Store mapping: sanitized version → original PUA version
                    originalPUAByStarText[sanitizePUAChars(content)] = content
                  }
                } catch {
                  /* skip non-JSON properties */
                }
              }
            }

            // Precompute maps to avoid repeated O(n) scans while rendering
            const printImageLinkByAreaId: Record<string, string | undefined> = {}
            const svgImageLinkByAreaId: Record<string, string | undefined> = {}
            for (const pi of print_images || []) {
              const areaId = pi?.printAreaId
              if (!areaId) continue
              printImageLinkByAreaId[areaId] = pi?.image?.originalSrc
              svgImageLinkByAreaId[areaId] = pi?.svg?.originalSrc
            }

            // Map imageName -> imageSrc for each print area, and also keep a fallback src per area
            const imageNameToSrcByArea: Record<string, Record<string, string>> = {}
            const anyImageSrcByArea: Record<string, string> = {}

            // Map to track which option set labels are image options by print area
            const imageOptionSetLabelsByArea: Record<string, Set<string>> = {}

            for (const p of properties || []) {
              const name: string | undefined = typeof p?.name === 'string' ? p.name : undefined
              if (!name) continue
              if (!name.startsWith(`_${PROPERTY_PREFIX} `)) continue
              if (name.includes(`${PRINT_ID_PREFIX}:`)) continue

              // Attempt to extract print area id from the property name
              const parts = name.split(' ')
              let areaId = parts[1]
              const optionSetId = parts[2]
              if (!printAreaIds.includes(areaId)) {
                areaId = printAreaIds.find(id => name.includes(id)) || ''
              }
              if (!areaId) continue

              try {
                const parsed = typeof p.value === 'string' ? JSON.parse(p.value) : p.value
                const src: string | undefined = parsed?.image?.imageSrc
                const imageName: string | undefined = parsed?.image?.imageName
                if (!src) continue

                if (!anyImageSrcByArea[areaId]) {
                  anyImageSrcByArea[areaId] = src
                }
                if (imageName) {
                  imageNameToSrcByArea[areaId] = imageNameToSrcByArea[areaId] || {}
                  imageNameToSrcByArea[areaId][imageName] = src
                }

                // Track which option sets are image options
                if (optionSetId) {
                  const printArea = variantTemplate?.printAreas?.find((pa: any) => pa._id === areaId)
                  const layers = printArea?.template?.layers
                  const matchedLayer = layers?.find(
                    (layer: any) =>
                      (layer.type === 'text' && layer._id === optionSetId) || layer.optionSet?._id === optionSetId
                  )

                  if (
                    matchedLayer?.optionSet?.type === 'image_option'
                    || matchedLayer?.optionSet?.type === 'mask_option'
                  ) {
                    if (!imageOptionSetLabelsByArea[areaId]) {
                      imageOptionSetLabelsByArea[areaId] = new Set()
                    }
                    const optionSetLabel = matchedLayer.optionSet?.label
                    if (optionSetLabel) {
                      imageOptionSetLabelsByArea[areaId].add(optionSetLabel)
                    }
                  }
                }
              } catch {
                // ignore invalid JSON
              }
            }

            // Suffix of presentment money
            const itemCurrency = presentment_money.currency_code

            const presentmentMoneyFormatted = (amount: number) => {
              const _amount = +amount
              return `${formatOptionDisplayPricing({ value: _amount, flatRate: _amount }, itemCurrency, false)}`
            }

            return (
              <Card key={item.id}>
                <InlineStack gap={'200'} wrap={false}>
                  <Box>
                    <Thumbnail source={getShopifyThumbnail(image)} alt={title} size="large" />
                  </Box>
                  <Box width="100%">
                    <BlockStack gap={'050'}>
                      <InlineStack gap={'400'} wrap={false}>
                        <Box maxWidth="248px">
                          <BlockStack gap={'050'}>
                            <Text as="span" variant="bodyMd" breakWord>
                              {title}
                            </Text>
                            <Box>
                              <Badge>{variant_title}</Badge>
                            </Box>
                          </BlockStack>
                        </Box>
                        <Text as="p" variant="bodyMd">
                          {presentmentMoneyFormatted(presentment_money.amount)}
                          {' x '} {current_quantity}
                        </Text>
                        <Text as="p" variant="bodyMd" fontWeight="medium">
                          {presentmentMoneyFormatted(presentment_money.amount * current_quantity)}
                        </Text>
                      </InlineStack>

                      <List>
                        <List.Item>
                          <Text as="p" variant="bodySm" fontWeight="medium">
                            {t('properties')}:
                          </Text>
                          <List>
                            {Object.keys(groupedOptions).map((printAreaLabel: string, index: number) => {
                              const printArea = variantTemplate?.printAreas?.find(
                                (printArea: any) => printArea._id === printAreaIds[index]
                              )

                              // Get image links (PNG and SVG)
                              const printImageLink = printImageLinkByAreaId[printAreaIds[index]]
                              const svgImageLink = svgImageLinkByAreaId[printAreaIds[index]]

                              return (
                                <List.Item key={index}>
                                  <BlockStack gap={'050'}>
                                    <InlineStack align="space-between">
                                      <InlineStack gap={'100'}>
                                        <Text as="span" variant="bodySm" fontWeight="medium">
                                          {t('print-area')}:
                                        </Text>
                                        <Text as="span" variant="bodySm">
                                          {printAreaLabel}
                                        </Text>
                                      </InlineStack>
                                      <InlineStack gap={'200'}>
                                        <Button
                                          variant="plain"
                                          onClick={() => onOpenPrintPreviewModal(`${id}-${printAreaIds[index]}`)}
                                          size="slim"
                                          icon={ViewIcon}
                                        >
                                          {t('preview')}
                                        </Button>
                                        <Button
                                          variant="plain"
                                          onClick={() => {
                                            printImageLink
                                              ? openInNewTab(printImageLink)
                                              : onOpenPrintPreviewModal(`${id}-${printAreaIds[index]}`)
                                          }}
                                          size="slim"
                                          icon={SaveIcon}
                                        >
                                          {t('download-png')}
                                        </Button>
                                        {(svgImageLink || !canExportSvg) && (
                                          <FeatureRestrict
                                            feature="losslessSvgExport"
                                            hasAccess={canExportSvg}
                                            requiredPlan={svgRequiredPlan}
                                          >
                                            <Button
                                              variant="plain"
                                              onClick={() => svgImageLink && openInNewTab(svgImageLink)}
                                              size="slim"
                                              icon={SaveIcon}
                                            >
                                              {t('download-svg')}
                                            </Button>
                                          </FeatureRestrict>
                                        )}
                                      </InlineStack>
                                    </InlineStack>

                                    <List>
                                      {(propertiesGroupedByPrintAreas[printAreaLabel] || [])
                                        .filter(({ name }: { name: string }) => !name.startsWith('_'))
                                        .map((prop: { name: string; value: string }, idx: number) => (
                                          <List.Item key={idx}>
                                            <InlineStack gap="200" key={idx}>
                                              <Text as="span" variant="bodySm">
                                                {`${prop.name}:`}
                                              </Text>
                                              {(() => {
                                                const printAreaId = printAreaIds[index]

                                                // Some image option values include a pricing suffix appended by the storefront, e.g.
                                                // "filename.png (+₫300)". Strip the suffix to match the raw imageName keys.
                                                // Pattern: ` ([+-]currencyAmount)` at the END of the string only.
                                                // Regex: space + '(' + plus/minus + any non-')' chars with at least one digit + ')' at end
                                                const pricingSuffixRegex = / \([+-][^\)]*\d[^\)]*\)$/
                                                const value = prop.value
                                                const imageNameToSrcByAreaMap = imageNameToSrcByArea[printAreaId]

                                                const normalizedValue
                                                  = typeof value === 'string' ? value.replace(pricingSuffixRegex, '') : ''
                                                const byName
                                                  = imageNameToSrcByAreaMap?.[value]
                                                  || imageNameToSrcByAreaMap?.[normalizedValue]
                                                const fallback = anyImageSrcByArea[printAreaId]
                                                const imageSrc = byName || fallback

                                                // Show link if this property belongs to an image option set OR we have a matching image source
                                                const labelsSet = imageOptionSetLabelsByArea[printAreaId]
                                                const isImageOptionSet = labelsSet
                                                  ? Array.from(labelsSet).some(
                                                      label =>
                                                        prop.name === label
                                                        || prop.name.startsWith(`${label} `)
                                                        || prop.name.startsWith(`${label} #`)
                                                    )
                                                  : false

                                                // Look up compositedThumbnailSrc from template for images with overlay
                                                let finalImageSrc = imageSrc
                                                if (imageSrc) {
                                                  const currentPrintArea = variantTemplate?.printAreas?.find(
                                                    (pa: any) => pa._id === printAreaId
                                                  )
                                                  const layers = currentPrintArea?.template?.layers || []
                                                  for (const layer of layers) {
                                                    // optionSet is an array, check each one
                                                    const optionSets = Array.isArray(layer.optionSet)
                                                      ? layer.optionSet
                                                      : []
                                                    for (const optSet of optionSets) {
                                                      if (optSet?.type === 'image_option') {
                                                        const optionFiles = optSet?.data?.files || []
                                                        const matchingOption = optionFiles.find(
                                                          (f: any) => f.name === normalizedValue || f.name === value
                                                        )
                                                        if (matchingOption?.compositedThumbnailSrc) {
                                                          finalImageSrc = matchingOption.compositedThumbnailSrc
                                                          break
                                                        }
                                                      }
                                                    }
                                                    if (finalImageSrc !== imageSrc) break
                                                  }
                                                }

                                                if (finalImageSrc && (isImageOptionSet || byName)) {
                                                  return (
                                                    <Link target="_blank" url={finalImageSrc}>
                                                      {prop.value}
                                                    </Link>
                                                  )
                                                }

                                                // Use original PUA text with emoji font if available, otherwise show ★ version
                                                const originalPUA = originalPUAByStarText[prop.value]
                                                if (originalPUA && emojiFontFamily) {
                                                  return (
                                                    <Text as="span" variant="bodySm">
                                                      <span style={{ fontFamily: emojiFontFamily }}>{originalPUA}</span>
                                                    </Text>
                                                  )
                                                }
                                                return (
                                                  <Text as="span" variant="bodySm">
                                                    {prop.value}
                                                  </Text>
                                                )
                                              })()}
                                            </InlineStack>
                                          </List.Item>
                                        ))}
                                    </List>
                                  </BlockStack>
                                  <PreviewPrintImage
                                    t={t}
                                    lineItem={item}
                                    order={order}
                                    product={product}
                                    variant={variant}
                                    shopData={shopData}
                                    printArea={printArea}
                                    printImageLink={printImageLink}
                                    PROPERTY_PREFIX={PROPERTY_PREFIX}
                                    modalId={`tailorkit-modal-${id}-${printAreaIds[index]}`}
                                    modalOpen={modalOpen}
                                    setModalOpen={setModalOpen}
                                    downloadFileNamePrefix={order?.order_number && `${order.order_number} `}
                                  />
                                </List.Item>
                              )
                            })}
                          </List>
                        </List.Item>
                      </List>
                    </BlockStack>
                  </Box>
                </InlineStack>
                {charms.length > 0 && (
                  <Box paddingBlockStart="200" borderBlockStartWidth="025" borderColor="border">
                    <BlockStack gap="100">
                      <Box paddingInlineStart="200" paddingInlineEnd="200" paddingBlockStart="100">
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="100" blockAlign="center">
                            <Text as="p" variant="bodySm" fontWeight="semibold" tone="subdued">
                              {t('charms')}
                            </Text>
                            <Badge tone="info" size="small">
                              {String(charms.length)}
                            </Badge>
                          </InlineStack>
                          <Text as="p" variant="bodySm" fontWeight="medium" tone="subdued">
                            {presentmentMoneyFormatted(
                              charms.reduce((sum: number, c: any) => {
                                const amt = c.price_set?.presentment_money?.amount || 0
                                return sum + +amt * (c.current_quantity || 1)
                              }, 0)
                            )}
                          </Text>
                        </InlineStack>
                      </Box>
                      {charms.map((charm: any) => (
                        <CharmNestedRow key={charm.id} charm={charm} currencyFormatter={presentmentMoneyFormatted} />
                      ))}
                      <Box
                        paddingBlockStart="100"
                        paddingInlineStart="200"
                        paddingInlineEnd="200"
                        borderBlockStartWidth="025"
                        borderColor="border"
                      >
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="p" variant="bodySm" fontWeight="semibold">
                            {t('total')}
                          </Text>
                          <Text as="p" variant="bodySm" fontWeight="semibold">
                            {presentmentMoneyFormatted(
                              presentment_money.amount * current_quantity
                                + charms.reduce((sum: number, c: any) => {
                                  const amt = c.price_set?.presentment_money?.amount || 0
                                  return sum + +amt * (c.current_quantity || 1)
                                }, 0)
                            )}
                          </Text>
                        </InlineStack>
                      </Box>
                    </BlockStack>
                  </Box>
                )}
              </Card>
            )
          })}

          {fulfillmentOrder ? (
            <OrderFulfillActions
              vendor={vendor}
              orderId={order.id}
              fulfillmentOrderId={fulfillmentOrderId}
              fulfillmentOrder={fulfillmentOrder}
              shopId={shopId}
              requestingFulfillment={requestingFulfillment}
              onRequestFulfillment={onRequestFulfillment}
              openOrderDetail={openOrderDetail}
              onOpenFulfillmentOrder={onOpenFulfillmentOrder}
            />
          ) : null}
        </BlockStack>
      </BlockStack>
    </Card>
  )
}

export default OrderDetailCard
