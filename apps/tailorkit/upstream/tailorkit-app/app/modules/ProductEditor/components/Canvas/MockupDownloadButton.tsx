import { ActionList, Button, ButtonGroup, Popover, Tooltip } from '@shopify/polaris'
import { useCallback, useMemo, useState } from 'react'
import { LAYER_BASE_PRODUCT_IMAGE } from '~/constants/integration'
import { useIntegrationEditorContext } from '../../contexts'
import { useTranslation } from 'react-i18next'
import { ChevronDownIcon, ChevronUpIcon, UploadIcon } from '@shopify/polaris-icons'
import styles from '~/components/canvas/ToolBar/styles.module.css'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { formatShopifyObjectIdToNumberId } from '~/utils/shopify'
import { PREFIX_PRODUCT_ID } from '~/constants/shopify'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { exportCanvasWithPreviewImage } from '~/modules/TemplateEditor/utilities/canvas'
import { base64ToBlob } from '~/utils/file-types'
import { isTemporaryVariant } from '~/utils/integration/temporaryProduct'

function MockupDownloadButton() {
  const { stageRef } = useIntegrationEditorContext()
  const { t } = useTranslation()
  const { openModal } = useModal()
  const variants = useStore(IntegrationStore, state => state.variants)
  const [popoverActive, setPopoverActive] = useState(false)

  // Get first product from variants
  const product = useMemo(() => variants[0]?.product, [variants])

  // Detect temporary products
  const isTemporary = useMemo(() => {
    const firstVariant = variants[0]
    return isTemporaryVariant(firstVariant?.id ?? '')
  }, [variants])

  const togglePopover = useCallback(() => {
    setPopoverActive(prev => !prev)
  }, [])

  const handleApplyMockup = useCallback(async () => {
    setPopoverActive(false)
    if (!stageRef.current || !product?.id) {
      return
    }

    try {
      // Capture mockup with preview image as base64
      const stage = stageRef.current
      const baseProductImageLayer = stage.findOne(`#${LAYER_BASE_PRODUCT_IMAGE}`)
      const width = baseProductImageLayer?.width() || stage.width()
      const height = baseProductImageLayer?.height() || stage.height()

      const base64Data = await exportCanvasWithPreviewImage(stage, width, height)

      if (!base64Data) {
        throw new Error('Failed to capture mockup')
      }

      // Convert GID to numeric ID for API route
      const productNumberId = formatShopifyObjectIdToNumberId(product.id, PREFIX_PRODUCT_ID)

      // Open modal immediately with base64 data - upload will happen in the background
      openModal(MODAL_ID.APPLY_AI_MOCKUPS_MODAL, {
        productId: productNumberId,
        productTitle: product?.title,
        mockupBase64: base64Data,
        isTemporary,
      })
    } catch (error) {
      console.error('Error capturing mockup:', error)
      showGenericErrorToast()
    }
  }, [stageRef, product, openModal, isTemporary])

  const onDownloadHandler = useCallback(async () => {
    if (!stageRef.current) {
      return
    }

    try {
      const stage = stageRef.current
      const baseProductImageLayer = stage.findOne(`#${LAYER_BASE_PRODUCT_IMAGE}`)
      const width = baseProductImageLayer?.width() || stage.width()
      const height = baseProductImageLayer?.height() || stage.height()

      // Capture mockup as base64 then convert to blob for download
      const base64Data = await exportCanvasWithPreviewImage(stage, width, height)

      if (!base64Data) {
        showGenericErrorToast()
        return
      }

      // Remove data URL prefix if present (e.g., "data:image/webp;base64,")
      let base64String = base64Data
      if (base64String.startsWith('data:')) {
        const base64Index = base64String.indexOf(',')
        if (base64Index !== -1) {
          base64String = base64String.substring(base64Index + 1)
        }
      }

      const blob = base64ToBlob(base64String, 'image/webp')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const productTitle = product?.title || 'product'
      const sanitizedTitle = productTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()
      a.download = `${sanitizedTitle}-mockup.webp`
      a.click()
    } catch (error) {
      console.error('Error downloading mockup:', error)
      showGenericErrorToast()
    }
  }, [stageRef, product])

  return (
    <div className={styles.ToolItem}>
      <div className={styles.DownloadToolIcon}>
        <ButtonGroup variant="segmented">
          <Tooltip content={t('download-mockup-image')}>
            <Button icon={UploadIcon} variant="tertiary" onClick={onDownloadHandler}>
              {t('download-mockup')}
            </Button>
          </Tooltip>
          <Popover
            active={popoverActive}
            preferredAlignment="right"
            activator={
              <Button
                variant="tertiary"
                onClick={togglePopover}
                icon={popoverActive ? ChevronDownIcon : ChevronUpIcon}
                accessibilityLabel={t('more-mockup-options')}
              />
            }
            autofocusTarget="first-node"
            onClose={togglePopover}
          >
            <ActionList
              actionRole="menuitem"
              items={[
                {
                  content: t('apply-mockup'),
                  helpText: t('apply-it-directly-to-your-product-page-or-set-it-as-the-feature-image'),
                  onAction: handleApplyMockup,
                },
              ]}
            />
          </Popover>
        </ButtonGroup>
      </div>
    </div>
  )
}

export default MockupDownloadButton
