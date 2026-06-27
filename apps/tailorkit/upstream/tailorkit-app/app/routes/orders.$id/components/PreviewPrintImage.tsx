import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import BlockLoading from '~/components/loading/BlockLoading'
import { Banner, Modal } from '@shopify/polaris'
import { TemplatesService } from '~/api/services/templates'
import { canUseFreeResources } from '~/models/PricingPlan.fns'
import { isValidImageUrl } from '~/utils/image-processing/validation/url'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FULFILLED } from '~/constants/fulfillment-providers'
import { drawPrintImageOnCanvas } from '../fns.client'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

// Narrow shapes for the four props this component actually reads. Fields are
// optional because the source data (Shopify Admin GraphQL line items, internal
// `LineItem` alias which is `any`) is intentionally loose at the project
// boundary — these interfaces document expectations without forcing the caller
// to satisfy a strict contract.
interface OrderShape {
  fulfillment_status?: string
  order_number?: string | number
  id?: string | number
}

interface LineItemPropertyShape {
  name?: string
  value?: string
}

interface LineItemShape {
  id?: string | number
  properties?: LineItemPropertyShape[]
}

interface ProductVariantShape {
  displayName?: string
}

interface ProductShape {
  title?: string
  variants?: ProductVariantShape[]
}

interface PrintAreaShape {
  _id?: string
  name?: string
  template?: { _id?: string }
  width?: number
  height?: number
}

type PreviewPrintImageProps = WithTranslationProps & {
  order: OrderShape
  product: ProductShape
  lineItem: LineItemShape
  printArea: PrintAreaShape
  modalId: string
  PROPERTY_PREFIX: string
  printImageLink?: string
}

const CONTAINER_ID = 'canvas-preview-container'

// Must match CANVAS_PREVIEW_PROPERTY_KEY in
// extensions/tailorkit-src/src/assets/constants/index.ts — that key is what the
// storefront sets at cart-add time as the buyer-facing preview thumbnail.
const LINE_ITEM_PREVIEW_PROPERTY_KEY = '_Preview'

export default function PreviewPrintImage(props: PreviewPrintImageProps) {
  // Extract necessary variables from component props
  const {
    t,
    order,
    modalId,
    modalOpen,
    variant,
    shopData,
    PROPERTY_PREFIX,
    printImageLink,
    downloadFileNamePrefix = '',
    lineItem: { properties },
    product: { variants, title: productTitle } = {},
    printArea: { _id, name: printAreaName, template, width, height } = {},
    setModalOpen,
  } = props

  const templateId = template?._id
  // Generate title for line item
  const title = ((variants?.length ?? 0) > 1 && variant?.displayName) || productTitle

  // Fetch template data if missing in template config
  const [loading, setLoading] = useState<boolean>(true)
  const [canvasDrawing, setCanvasDrawing] = useState<boolean>(false)
  const [templateConfig, setTemplateConfig] = useState<any>(templateId)
  // True when the buyer-side `_Preview` thumbnail is being shown instead of the
  // canvas-rendered print image. Surfaces a warning Banner so merchants don't
  // mistake the composite cart preview for a print-ready per-area file.
  const [usedFallbackPreview, setUsedFallbackPreview] = useState<boolean>(false)

  // Prevent page scroll when modal is open
  usePreventPageScroll(!!modalOpen)

  const imageGeneratedRef = useRef<HTMLImageElement>(null)

  // Fallback preview URL captured at cart-add time on the storefront. Used only
  // when neither the pre-uploaded print image nor the client-side canvas render
  // produces an image — prevents a broken thumbnail when a layer asset has been
  // deleted from Shopify Files / CDN after the order was placed.
  //
  // The value is set by our extension at cart-add (a Shopify CDN URL or S3
  // signed URL), but line-item properties are mutable via Admin API after the
  // fact, so we run it through the project's image-URL validator for the https
  // + domain allowlist (cdn.shopify.com / shopify.com / s3.amazonaws.com).
  //
  // Extension check is disabled (`validExtensions: []`) because Shopify Files
  // CDN can return content-typed image URLs without a file extension in the
  // path. The `<img>` tag itself is the defence against non-image responses —
  // a non-image payload simply fails to render. Trust boundary stays at the
  // host allowlist.
  const lineItemPreviewUrl = useMemo<string | undefined>(() => {
    if (!Array.isArray(properties)) return undefined
    const prop = properties.find(p => p?.name === LINE_ITEM_PREVIEW_PROPERTY_KEY)
    const raw = typeof prop?.value === 'string' ? prop.value.trim() : ''
    if (!raw) return undefined
    return isValidImageUrl(raw, { validExtensions: [] }) ? raw : undefined
  }, [properties])

  useEffect(() => {
    ;(async () => {
      if (typeof templateConfig === 'string') {
        const response = await TemplatesService.getById(templateConfig)
        setLoading(false)
        setTemplateConfig(response)
      } else {
        setLoading(false)
      }
    })()
  }, [templateConfig])

  // Define a function to allow merchants download the final print image
  const downloadPrintImage = useCallback(async () => {
    if (!modalOpen || loading) {
      return
    }

    // Verify merchant usage
    if (order.fulfillment_status !== FULFILLED && !canUseFreeResources({ shopData })) {
      return alert(
        t('you-have-used-all-of-your-monthly-free-orders-please-upgrade-your-plan-to-continue-to-fulfill-orders')
      )
    }

    // Get the canvas
    setCanvasDrawing(true)

    let imageUrl = printImageLink

    if (!imageUrl && _id !== undefined && _id !== null && properties && width !== undefined && height !== undefined) {
      const result = await drawPrintImageOnCanvas({
        _id: String(_id),
        containerId: CONTAINER_ID,
        // Function's signature declares a single-element tuple but accepts a
        // full array at runtime; cast to satisfy the declared type without
        // changing behaviour.
        properties: properties as [{ name: string; value: string }],
        templateConfig,
        PROPERTY_PREFIX,
        printAreaDimension: { width, height },
      })
      imageUrl = result?.png
    }

    if (imageUrl) {
      // Create a link element
      const downloadLink = document.createElement('a')

      // Set the file name to something easy to understand
      downloadLink.download = t('prefix-print-image-for-printarea-name-on-title-product-png', {
        title,
        printAreaName,
        prefix: downloadFileNamePrefix,
      })

      // Attach the data URI to the link element
      downloadLink.href = imageUrl

      // Bypass the error `Tainted canvases may not be exported`
      downloadLink.setAttribute('crossOrigin', 'anonymous')

      // Force a click event on the download link
      downloadLink.click()
    }

    setCanvasDrawing(false)
  }, [
    modalOpen,
    loading,
    order.fulfillment_status,
    shopData,
    _id,
    properties,
    templateConfig,
    PROPERTY_PREFIX,
    width,
    height,
    t,
    title,
    printAreaName,
    downloadFileNamePrefix,
    printImageLink,
  ])

  // Draw the final print preview on top of the selected product image
  useEffect(() => {
    if (!modalOpen || loading) {
      return
    }

    // Get the canvas to draw the final print preview
    ;(async () => {
      // Same entitlement gate as the JSX render path — fallback URL also stays
      // behind it so a non-entitled merchant never gets a preview image silently
      // loaded into the DOM.
      if (order.fulfillment_status !== FULFILLED && !canUseFreeResources({ shopData })) {
        return
      }

      let imageUrl: string | undefined

      try {
        imageUrl = printImageLink

        if (
          !imageUrl
          && _id !== undefined
          && _id !== null
          && properties
          && width !== undefined
          && height !== undefined
        ) {
          const result = await drawPrintImageOnCanvas({
            _id: String(_id),
            containerId: CONTAINER_ID,
            properties: properties as [{ name: string; value: string }],
            templateConfig,
            PROPERTY_PREFIX,
            printAreaDimension: { width, height },
          })
          imageUrl = result?.png
        }
      } catch (err) {
        console.error('[TailorKit] Print preview render failed:', err)
      }

      // Last-resort fallback to the buyer-facing preview captured at cart-add
      // time, so merchants always see something instead of a broken thumbnail
      // when a referenced layer asset is gone (e.g., deleted from Shopify Files).
      let fallbackInUse = false
      if (!imageUrl && lineItemPreviewUrl) {
        imageUrl = lineItemPreviewUrl
        fallbackInUse = true
      }

      setUsedFallbackPreview(fallbackInUse)

      if (imageUrl && imageGeneratedRef.current) {
        imageGeneratedRef.current.src = imageUrl
      }
    })()
  }, [
    PROPERTY_PREFIX,
    _id,
    height,
    lineItemPreviewUrl,
    loading,
    modalOpen,
    order.fulfillment_status,
    printImageLink,
    properties,
    shopData,
    templateConfig,
    width,
  ])

  return (
    <Fragment>
      {/* Hidden container to draw the final print preview */}
      <div id={CONTAINER_ID} style={{ display: 'none' }}></div>
      <ui-modal id={modalId}>
        {loading ? (
          <BlockLoading />
        ) : order.fulfillment_status !== FULFILLED && !canUseFreeResources({ shopData }) ? (
          <Modal.Section>
            <Banner tone="critical">
              {t(
                'you-have-used-all-of-your-monthly-free-orders-please-upgrade-your-plan-to-continue-to-fulfill-orders'
              )}
            </Banner>
          </Modal.Section>
        ) : (
          <>
            {usedFallbackPreview && (
              <Modal.Section>
                <Banner tone="warning">
                  {t(
                    'showing-the-buyer-cart-preview-print-file-could-not-be-generated-likely-because-a-referenced-image-is-missing'
                  )}
                </Banner>
              </Modal.Section>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'auto',
              }}
            >
              <img
                ref={imageGeneratedRef}
                alt={t('print-image-for-the-area-printarea-name-on-the-product-title', { title, printAreaName })}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>
            <ui-title-bar
              title={t('print-image-for-the-area-printarea-name-on-the-product-title', { title, printAreaName })}
            >
              {(order.fulfillment_status === FULFILLED || canUseFreeResources({ shopData })) && (
                <button
                  variant="primary"
                  onClick={downloadPrintImage}
                  loading={canvasDrawing ? true : undefined}
                  disabled={usedFallbackPreview ? true : undefined}
                >
                  {t('download')}
                </button>
              )}

              <button
                onClick={() => {
                  // `<ui-modal>` is Shopify Admin's custom element; `.hide()` is
                  // its imperative API. Cast to the element shape rather than
                  // suppressing the type error.
                  const modalEl = document.getElementById(modalId) as (HTMLElement & { hide?: () => void }) | null
                  modalEl?.hide?.()
                  setModalOpen(false)
                }}
              >
                {t('close')}
              </button>
            </ui-title-bar>
          </>
        )}
      </ui-modal>
    </Fragment>
  )
}
