/**
 * ImageFillEditor - Configure image paint properties
 *
 * Allows users to:
 * - Select an image from media library
 * - Select pattern size (Stretch, Stretch-X/Y, or tile at 10%-100%)
 * - Adjust opacity and image filters
 *
 * @module TemplateEditor/elements/components/Text/Styling/Fill
 */

import {
  BlockStack,
  Box,
  Button,
  ButtonGroup,
  Icon,
  InlineStack,
  Select,
  Text,
  Thumbnail,
  Tooltip,
} from '@shopify/polaris'
import { AdjustIcon, DeleteIcon, ImageIcon, PlusIcon, ReplaceIcon, RotateRightIcon } from '@shopify/polaris-icons'
import { Accordion } from '~/components/Accordion'
import type {
  ImageFilters,
  ImagePaint,
  ImageScaleMode,
  Paint,
  PatternSize,
} from 'extensions/tailorkit-src/src/shared/libraries/paint'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ImageSelector from '~/modules/modals/ImageSelector'
import type { IImageQuery } from '~/types/shopify-files'
import { useDebouncedCallback } from '~/utils/hooks/useDebouncedCallback'
import { ImageFilterOptions } from './ImageFilter'
import { FlexCenter } from '~/components/common/Flex'
import { NumericStepperField } from '~/components/common/NumericStepperField'

interface ImageFillEditorProps {
  /** Current image paint value */
  value: ImagePaint | undefined
  /** Callback when paint changes */
  onChange: (paint: Paint) => void
  /** Shop domain for asset uploads */
  shopDomain?: string
}

/** Pattern size options for image fills */
const PATTERN_SIZE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Stretch', value: 'stretch' },
  { label: 'Stretch-X', value: 'stretch-x' },
  { label: 'Stretch-Y', value: 'stretch-y' },
  { label: '100%', value: '100' },
  { label: '90%', value: '90' },
  { label: '80%', value: '80' },
  { label: '70%', value: '70' },
  { label: '60%', value: '60' },
  { label: '50%', value: '50' },
  { label: '40%', value: '40' },
  { label: '30%', value: '30' },
  { label: '20%', value: '20' },
  { label: '10%', value: '10' },
]

/**
 * Convert PatternSize to internal scaleMode
 */
function patternSizeToScaleMode(patternSize: PatternSize | undefined): ImageScaleMode {
  if (patternSize === 'stretch') return 'FILL'
  if (typeof patternSize === 'number' || patternSize === 'stretch-x' || patternSize === 'stretch-y') return 'TILE'
  return 'TILE' // Default to TILE for tiling behavior
}

/**
 * Get the display value for pattern size dropdown
 */
function getPatternSizeDisplayValue(patternSize: PatternSize | undefined): string {
  if (patternSize === undefined) return '100' // Default to 100%
  if (typeof patternSize === 'number') return String(patternSize)
  return patternSize
}

export function ImageFillEditor({ value, onChange }: ImageFillEditorProps) {
  const [imageModalActive, setImageModalActive] = useState(false)
  const { t } = useTranslation()

  // Local state for filters and opacity - allows smooth slider updates while debouncing expensive renders
  const [localFilters, setLocalFilters] = useState<ImageFilters>(value?.filters || {})
  const [localOpacity, setLocalOpacity] = useState(value?.opacity ?? 1)

  // Sync local state when props change externally (e.g., undo/redo)
  useEffect(() => {
    setLocalFilters(value?.filters || {})
    setLocalOpacity(value?.opacity ?? 1)
  }, [value?.filters, value?.opacity])

  const openImageSelectorModal = useCallback(() => {
    setImageModalActive(true)
  }, [])

  const closeImageSelectorModal = useCallback(() => {
    setImageModalActive(false)
  }, [])

  const handleSelectImage = useCallback(
    (imageSelected: IImageQuery[] | null) => {
      if (imageSelected?.length) {
        const {
          image: { originalSrc },
        } = imageSelected[0]

        // Default to patternSize: 100 (tile at original size)
        const patternSize = value?.patternSize ?? 100

        onChange({
          type: 'IMAGE',
          imageRef: originalSrc,
          scaleMode: patternSizeToScaleMode(patternSize),
          patternSize,
          opacity: value?.opacity ?? 1,
          visible: true,
        })
      }
      closeImageSelectorModal()
    },
    [value, onChange, closeImageSelectorModal]
  )

  const handlePatternSizeChange = useCallback(
    (selectedValue: string) => {
      // Parse the selected value to PatternSize
      const patternSize: PatternSize
        = selectedValue === 'stretch' || selectedValue === 'stretch-x' || selectedValue === 'stretch-y'
          ? selectedValue
          : parseInt(selectedValue, 10)

      onChange({
        type: 'IMAGE',
        imageRef: value?.imageRef || '',
        scaleMode: patternSizeToScaleMode(patternSize),
        patternSize,
        opacity: value?.opacity ?? 1,
        transform: value?.transform,
        filters: value?.filters,
        visible: true,
      })
    },
    [value, onChange]
  )

  // Debounced opacity change
  const debouncedOpacityChange = useDebouncedCallback((opacity: number) => {
    const patternSize = value?.patternSize ?? 100
    onChange({
      type: 'IMAGE',
      imageRef: value?.imageRef || '',
      scaleMode: patternSizeToScaleMode(patternSize),
      patternSize,
      opacity,
      transform: value?.transform,
      filters: value?.filters,
      visible: true,
    })
  }, 100)

  const handleOpacityChange = useCallback(
    (opacity: number) => {
      setLocalOpacity(opacity)
      debouncedOpacityChange(opacity)
    },
    [debouncedOpacityChange]
  )

  const handleRemoveImage = useCallback(() => {
    onChange({
      type: 'IMAGE',
      imageRef: '',
      scaleMode: 'TILE',
      patternSize: 100, // Reset to default
      opacity: 1,
      visible: true,
    })
  }, [onChange])

  const handleRotateImage = useCallback(() => {
    const currentRotation = value?.transform?.rotation ?? 0
    const newRotation = (currentRotation + 90) % 360
    const patternSize = value?.patternSize ?? 100

    onChange({
      type: 'IMAGE',
      imageRef: value?.imageRef || '',
      scaleMode: patternSizeToScaleMode(patternSize),
      patternSize,
      opacity: value?.opacity ?? 1,
      transform: {
        ...value?.transform,
        rotation: newRotation,
      },
      filters: value?.filters,
      visible: true,
    })
  }, [value, onChange])

  // Debounced callback to parent - only triggers expensive re-render after delay
  const debouncedOnChange = useDebouncedCallback((filters: ImageFilters) => {
    const patternSize = value?.patternSize ?? 100
    onChange({
      type: 'IMAGE',
      imageRef: value?.imageRef || '',
      scaleMode: patternSizeToScaleMode(patternSize),
      patternSize,
      opacity: value?.opacity ?? 1,
      transform: value?.transform,
      filters,
      visible: true,
    })
  }, 150)

  const handleFilterChange = useCallback(
    (filterKey: keyof ImageFilters, filterValue: number) => {
      const newFilters: ImageFilters = {
        ...localFilters,
        [filterKey]: filterValue,
      }

      // Update local state immediately for smooth UI
      setLocalFilters(newFilters)

      // Debounce the expensive parent callback
      debouncedOnChange(newFilters)
    },
    [localFilters, debouncedOnChange]
  )

  const hasImage = !!value?.imageRef

  return (
    <BlockStack gap="300">
      {/* Image Selection Area */}
      {hasImage ? (
        <Box background="bg-surface-secondary" borderRadius="200" padding="300">
          <InlineStack gap="300" blockAlign="center" align="space-between">
            <InlineStack gap="300" blockAlign="center">
              <Box borderRadius="150">
                <Thumbnail source={value.imageRef} alt={t('fill-image')} size="medium" />
              </Box>
              <Text as="span" variant="bodySm" tone="subdued">
                {t('image-fill')}
              </Text>
            </InlineStack>
            <ButtonGroup>
              <Tooltip content={t('rotate-90')}>
                <Button
                  icon={RotateRightIcon}
                  onClick={handleRotateImage}
                  accessibilityLabel={t('rotate-90')}
                  size="slim"
                />
              </Tooltip>
              <Tooltip content={t('replace')}>
                <Button
                  icon={ReplaceIcon}
                  onClick={openImageSelectorModal}
                  accessibilityLabel={t('replace')}
                  size="slim"
                />
              </Tooltip>
              <Tooltip content={t('remove')}>
                <Button
                  icon={DeleteIcon}
                  tone="critical"
                  onClick={handleRemoveImage}
                  accessibilityLabel={t('remove')}
                  size="slim"
                />
              </Tooltip>
            </ButtonGroup>
          </InlineStack>
        </Box>
      ) : (
        <Box
          // background="bg-surface-secondary"
          borderRadius="200"
          padding="400"
          borderStyle="dashed"
          borderWidth="050"
          borderColor="border-secondary"
        >
          <BlockStack gap="300" align="center">
            <FlexCenter>
              <Box>
                <ImageIcon width={50} height={50} />
              </Box>
            </FlexCenter>
            <Button icon={PlusIcon} onClick={openImageSelectorModal} variant="primary">
              {t('select-image')}
            </Button>
          </BlockStack>
        </Box>
      )}

      {/* Image Settings - only show when image is selected */}
      {hasImage && (
        <BlockStack gap="200">
          {/* Pattern Size */}
          <InlineStack gap="300" align="space-between" wrap={false} blockAlign="center">
            <Text as="p" variant="bodyMd">
              {t('pattern-size')}
            </Text>
            <Box minWidth="120px">
              <Select
                label={t('pattern-size')}
                labelHidden
                options={PATTERN_SIZE_OPTIONS}
                value={getPatternSizeDisplayValue(value.patternSize)}
                onChange={handlePatternSizeChange}
              />
            </Box>
          </InlineStack>

          {/* Opacity */}
          <InlineStack gap="300" align="space-between" wrap={false} blockAlign="center">
            <Text as="p" variant="bodyMd">
              {t('opacity')}
            </Text>
            <Box width="80px">
              <NumericStepperField
                label={t('opacity')}
                labelHidden
                value={Math.round(localOpacity * 100)}
                min={0}
                max={100}
                onChange={v => {
                  const num = Math.min(100, Math.max(0, v || 0))
                  handleOpacityChange(num / 100)
                }}
                hideNumericStepper
              />
            </Box>
          </InlineStack>

          {/* Image Filters - Collapsible Card */}
          <Box paddingBlockStart="100">
            <Box background="bg-surface-secondary" borderRadius="200">
              <Accordion
                id="image-filters"
                open={false}
                hideDivider
                paddingBlockEnd="200"
                label={
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={AdjustIcon} tone="base" />
                    <Text variant="headingSm" fontWeight="medium" as="span">
                      {t('filters')}
                    </Text>
                  </InlineStack>
                }
                content={<ImageFilterOptions value={localFilters} onChange={handleFilterChange} />}
              />
            </Box>
          </Box>
        </BlockStack>
      )}

      {/* Image Selector Modal */}
      {imageModalActive && (
        <ImageSelector
          active={imageModalActive}
          baseImage={value?.imageRef ? [{ url: value.imageRef, width: 0, height: 0, altText: '' }] : []}
          onSelectImage={handleSelectImage}
          onClose={closeImageSelectorModal}
          onIndicateClose={closeImageSelectorModal}
        />
      )}
    </BlockStack>
  )
}
