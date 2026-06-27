import { Banner, Box, List } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { Fragment } from 'react/jsx-runtime'
import type { PrintArea } from '~/types/integration'
import type { Template } from '~/types/psd'
import { convertDimensionToPixels } from '~/utils/lengthUnitToPixels'
import { formatDimensions, hasSameAspectRatio } from './fns'
import type { Dimension } from '~/types/template'
import type { IModalTemplateSelectionProps } from './ModalTemplateSelection/TemplateCreation'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface BannerWarningDifferentDimensionProps {
  printArea: PrintArea
  mockupLayerConfig: IModalTemplateSelectionProps['templateConfig']
  template: Template
  bannerRef: any
  updateState: (state: any) => void
}

/**
 * Banner component that warns users when template dimensions don't match the print area.
 * Displays INFO banner for missing print area dimensions or WARNING banner for mismatched dimensions.
 */
function BannerWarningDifferentDimension(props: BannerWarningDifferentDimensionProps) {
  const { printArea, template, bannerRef, mockupLayerConfig, updateState } = props
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)

  // Memoize dimension calculations to prevent redundant conversions
  const dimensions = useMemo(() => {
    const { width: printAreaWidth = 0, height: printAreaHeight = 0 } = printArea
    const { width: templateWidth, height: templateHeight } = convertDimensionToPixels(template.dimension)
    const areaWidth = mockupLayerConfig?.width || 0
    const areaHeight = mockupLayerConfig?.height || 0

    return {
      printArea: { width: printAreaWidth, height: printAreaHeight },
      template: { width: templateWidth, height: templateHeight },
      mockup: { width: areaWidth, height: areaHeight },
    }
  }, [printArea, template.dimension, mockupLayerConfig])

  // Memoize validation logic to avoid duplicate calculations
  const validation = useMemo(() => {
    const { printArea: pa, mockup } = dimensions
    const isPrintAreaInvalid = !pa.width || !pa.height || (pa.width === 500 && pa.height === 500)

    // Case 1: Print area is invalid, check against mockup dimensions
    if (isPrintAreaInvalid) {
      if (!mockup.width || !mockup.height) {
        return { shouldDismiss: true, showInfo: false, showWarning: false }
      }

      const isSameRatio = hasSameAspectRatio(template.dimension, mockup, 1e-3)
      return {
        shouldDismiss: isSameRatio,
        showInfo: !isSameRatio,
        showWarning: false,
        targetDimensions: mockup,
      }
    }

    // Case 2: Print area is valid, check if template matches
    const isSameRatio = hasSameAspectRatio(template.dimension, printArea as Dimension, 1e-3)

    /**
     * ⚠️ DO NOT MODIFY - INTENTIONAL DESIGN!
     *
     * Only warn when template < print area (upscale causes quality loss)
     * No warn when template > print area (downscale preserves quality)
     *
     * WHY: Printing scales template to fit print area
     * - Larger template → downscale → no blur ✅
     * - Smaller template → upscale → blurry ❌
     */
    const isValidSize = template.dimension.width >= pa.width && template.dimension.height >= pa.height

    return {
      shouldDismiss: isSameRatio && isValidSize,
      showInfo: false,
      showWarning: !isSameRatio || !isValidSize,
      targetDimensions: pa,
    }
  }, [dimensions, template.dimension, printArea])

  const dismissBanner = useCallback(() => {
    setDismissed(true)
    updateState({ showBannerWarning: false })
  }, [updateState])

  // Auto-dismiss banner when template is valid
  useEffect(() => {
    if (validation.shouldDismiss) {
      dismissBanner()
    }
  }, [validation.shouldDismiss, dismissBanner])

  // Early return if dismissed or should be hidden
  if (dismissed || validation.shouldDismiss) {
    return <Fragment />
  }

  const { template: tmpl } = dimensions
  const templateDimensionsString = formatDimensions(tmpl.width, tmpl.height)

  // Show INFO banner for mockup dimension mismatch
  if (validation.showInfo && validation.targetDimensions) {
    const targetDimensionsString = formatDimensions(
      validation.targetDimensions.width,
      validation.targetDimensions.height
    )

    return (
      <Box paddingInline={'300'}>
        <Banner tone="info" ref={bannerRef} onDismiss={dismissBanner}>
          {t(
            'you-can-use-this-template-but-you-ll-need-to-adjust-its-layout-as-the-size-doesn-t-fit-the-personalization-area'
          )}
          <List>
            <List.Item>
              <b>{t('template-dimensions')}:</b> {templateDimensionsString}px
            </List.Item>
            <List.Item>
              <b>{t('area-size')}:</b> {targetDimensionsString}px
            </List.Item>
          </List>
        </Banner>
      </Box>
    )
  }

  // Show WARNING banner for print area dimension mismatch
  if (validation.showWarning && validation.targetDimensions) {
    const targetDimensionsString = formatDimensions(
      validation.targetDimensions.width,
      validation.targetDimensions.height
    )

    return (
      <Box paddingInline={'300'}>
        <Banner tone="warning" ref={bannerRef} onDismiss={dismissBanner}>
          {t('banner-warning-different-dimension')}
          <List>
            <List.Item>
              <b>{t('current-template-dimensions')}</b> {targetDimensionsString}px
            </List.Item>
            <List.Item>
              <b>{t('selected-template-dimensions')}</b> {templateDimensionsString}px
            </List.Item>
          </List>
        </Banner>
      </Box>
    )
  }

  return <Fragment />
}

export default BannerWarningDifferentDimension
