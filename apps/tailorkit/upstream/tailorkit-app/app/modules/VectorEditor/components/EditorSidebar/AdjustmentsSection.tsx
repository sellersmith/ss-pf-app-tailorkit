/**
 * AdjustmentsSection - Opacity, blend mode, and color adjustments for the sidebar
 * Extracted from ColorAdjustmentsPopover, without the Popover wrapper
 */

import { useState, useCallback, useEffect } from 'react'
import { Box, Button, BlockStack, InlineStack, Text, Select, RangeSlider, Divider } from '@shopify/polaris'
import { DeleteIcon } from '@shopify/polaris-icons'
import type { ColorAdjustments, BlendMode, ImageColorAdjustments } from '../../types'
import { useTranslation } from 'react-i18next'
import type { AdjustmentsSectionProps } from './types'
import styles from './styles.module.css'

type RangeSliderValue = number | [number, number]

function getSliderValue(value: RangeSliderValue): number {
  return Array.isArray(value) ? value[0] : value
}

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
]

const DEFAULT_ADJUSTMENTS: ColorAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hueRotate: 0,
  invert: 0,
  sepia: 0,
  grayscale: 0,
  opacity: 1,
}

const DEFAULT_IMAGE_ADJUSTMENTS: ImageColorAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hueRotate: 0,
  invert: 0,
  sepia: 0,
  grayscale: 0,
}

export default function AdjustmentsSection({
  selectedPath,
  disabled,
  selectedPathHasFilter,
  onColorAdjustmentsChange,
  onBlendModeChange,
  onOpacityChange,
  onResetAdjustments,
  isOverlayMode,
  imageColorAdjustments,
  onImageAdjustmentsChange,
  onImageAdjustmentChange,
  onImageAdjustmentCommit,
  isSelectedPathAdjustmentMask,
  selectedPathAdjustments,
  onUpdateAdjustmentMask,
  onUpdateAdjustmentMaskCommit,
}: AdjustmentsSectionProps) {
  const { t } = useTranslation()

  const effectiveImageAdjustments = isSelectedPathAdjustmentMask ? selectedPathAdjustments : imageColorAdjustments
  const isImageMode = (isOverlayMode && !selectedPath && !!onImageAdjustmentChange) || isSelectedPathAdjustmentMask

  const [adjustments, setAdjustments] = useState<ColorAdjustments>(DEFAULT_ADJUSTMENTS)
  const [opacity, setOpacity] = useState(1)
  const [blendMode, setBlendMode] = useState<BlendMode>('normal')
  const [localImageAdjustments, setLocalImageAdjustments] = useState<ImageColorAdjustments>(
    effectiveImageAdjustments || DEFAULT_IMAGE_ADJUSTMENTS
  )

  useEffect(() => {
    if (!selectedPath) return

    if (selectedPath.style.colorAdjustments) {
      setAdjustments({ ...DEFAULT_ADJUSTMENTS, ...selectedPath.style.colorAdjustments })
    } else {
      setAdjustments(DEFAULT_ADJUSTMENTS)
    }
    setOpacity(selectedPath.style.opacity ?? 1)
    setBlendMode(selectedPath.style.mixBlendMode || 'normal')
  }, [selectedPath])

  useEffect(() => {
    setLocalImageAdjustments(effectiveImageAdjustments || DEFAULT_IMAGE_ADJUSTMENTS)
  }, [effectiveImageAdjustments])

  const handleImageAdjustmentChange = useCallback(
    <K extends keyof ImageColorAdjustments>(key: K, value: ImageColorAdjustments[K]) => {
      const newAdjustments = { ...localImageAdjustments, [key]: value }
      setLocalImageAdjustments(newAdjustments)
      // Call parent callback immediately for real-time visual updates
      if (isSelectedPathAdjustmentMask && onUpdateAdjustmentMask) {
        onUpdateAdjustmentMask({ [key]: value })
      } else {
        onImageAdjustmentChange?.(key, value)
      }
    },
    [localImageAdjustments, isSelectedPathAdjustmentMask, onUpdateAdjustmentMask, onImageAdjustmentChange]
  )

  const handleImageAdjustmentMaskCommit = useCallback(() => {
    if (isSelectedPathAdjustmentMask && onUpdateAdjustmentMaskCommit) {
      onUpdateAdjustmentMaskCommit()
    } else if (!isSelectedPathAdjustmentMask && onImageAdjustmentCommit) {
      // Commit direct image adjustments (no path selected) to history
      onImageAdjustmentCommit()
    }
  }, [isSelectedPathAdjustmentMask, onUpdateAdjustmentMaskCommit, onImageAdjustmentCommit])

  const handleOpacityChange = useCallback(
    (value: number) => {
      setOpacity(value)
      // Call parent callback immediately for real-time visual updates
      onOpacityChange(value, false)
    },
    [onOpacityChange]
  )

  const handleOpacityCommit = useCallback(() => {
    onOpacityChange(opacity, true)
  }, [onOpacityChange, opacity])

  const handleBlendModeChange = useCallback(
    (value: string) => {
      const mode = value as BlendMode
      setBlendMode(mode)
      onBlendModeChange(mode, true)
    },
    [onBlendModeChange]
  )

  const handleAdjustmentChange = useCallback(
    (key: keyof ColorAdjustments, value: number) => {
      const newAdjustments = { ...adjustments, [key]: value }
      setAdjustments(newAdjustments)
      // Call parent callback immediately for real-time visual updates
      onColorAdjustmentsChange(newAdjustments, false)
    },
    [adjustments, onColorAdjustmentsChange]
  )

  const handleAdjustmentsCommit = useCallback(() => {
    onColorAdjustmentsChange(adjustments, true)
  }, [onColorAdjustmentsChange, adjustments])

  const handleReset = useCallback(() => {
    // Update local state first
    setAdjustments(DEFAULT_ADJUSTMENTS)
    setOpacity(1)
    setBlendMode('normal')
    // Use the combined reset callback to update all properties in a single call
    // This avoids the stale closure issue when calling multiple updatePathStyle in sequence
    if (onResetAdjustments) {
      onResetAdjustments()
    } else {
      // Fallback for backwards compatibility (though this has the stale closure issue)
      onColorAdjustmentsChange(DEFAULT_ADJUSTMENTS, true)
      onOpacityChange(1, true)
      onBlendModeChange('normal', true)
    }
  }, [onResetAdjustments, onColorAdjustmentsChange, onOpacityChange, onBlendModeChange])

  const handleImageReset = useCallback(() => {
    setLocalImageAdjustments(DEFAULT_IMAGE_ADJUSTMENTS)
    if (isSelectedPathAdjustmentMask && onUpdateAdjustmentMask) {
      onUpdateAdjustmentMask({
        brightness: 0,
        contrast: 0,
        saturation: 0,
        hueRotate: 0,
        invert: 0,
        sepia: 0,
        grayscale: 0,
      })
    } else {
      onImageAdjustmentsChange?.(undefined)
    }
  }, [isSelectedPathAdjustmentMask, onUpdateAdjustmentMask, onImageAdjustmentsChange])

  const hasAdjustments
    = adjustments.brightness !== 0
    || adjustments.contrast !== 0
    || adjustments.saturation !== 0
    || adjustments.hueRotate !== 0
    || adjustments.invert !== 0
    || adjustments.sepia !== 0
    || adjustments.grayscale !== 0
    || opacity !== 1
    || blendMode !== 'normal'

  const hasImageAdjustments
    = localImageAdjustments.brightness !== 0
    || localImageAdjustments.contrast !== 0
    || localImageAdjustments.saturation !== 0
    || localImageAdjustments.hueRotate !== 0
    || (localImageAdjustments.invert !== undefined && localImageAdjustments.invert !== 0)
    || (localImageAdjustments.sepia !== undefined && localImageAdjustments.sepia !== 0)
    || (localImageAdjustments.grayscale !== undefined && localImageAdjustments.grayscale !== 0)

  if (disabled && !isImageMode) {
    return (
      <Box padding="300">
        <Text as="p" tone="subdued">
          {t('select-a-path-to-edit-adjustments')}
        </Text>
      </Box>
    )
  }

  // Show message when a filter is applied to the selected path
  // Still allow clearing existing adjustments if any
  if (selectedPathHasFilter && !isImageMode) {
    return (
      <Box padding="300">
        <BlockStack gap="300">
          <Text as="p" tone="subdued">
            {t(
              'adjustments-are-unavailable-when-a-filter-is-applied-to-the-selected-path-remove-the-filter-to-enable-adjustments'
            )}
          </Text>
          {hasAdjustments && (
            <Button icon={DeleteIcon} tone="critical" onClick={handleReset}>
              {t('clear-all-adjustments')}
            </Button>
          )}
        </BlockStack>
      </Box>
    )
  }

  // Render image adjustments
  if (isImageMode) {
    return (
      <BlockStack gap="300">
        {/* Brightness & Contrast */}
        <BlockStack gap="200">
          <Text as="span" variant="bodySm" fontWeight="medium">
            {t('brightness-contrast')}
          </Text>

          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div className={styles.sliderWrapper} onPointerUp={handleImageAdjustmentMaskCommit}>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodySm" tone="subdued">
                {t('brightness')}
              </Text>
              <Text as="span" variant="bodySm">
                {Math.round(localImageAdjustments.brightness || 0)}
              </Text>
            </InlineStack>
            <RangeSlider
              label=""
              labelHidden
              value={Math.round(localImageAdjustments.brightness || 0)}
              min={-100}
              max={100}
              step={1}
              onChange={value => handleImageAdjustmentChange('brightness', getSliderValue(value))}
            />
          </div>

          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div className={styles.sliderWrapper} onPointerUp={handleImageAdjustmentMaskCommit}>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodySm" tone="subdued">
                {t('contrast')}
              </Text>
              <Text as="span" variant="bodySm">
                {Math.round(localImageAdjustments.contrast || 0)}
              </Text>
            </InlineStack>
            <RangeSlider
              label=""
              labelHidden
              value={Math.round(localImageAdjustments.contrast || 0)}
              min={-100}
              max={100}
              step={1}
              onChange={value => handleImageAdjustmentChange('contrast', getSliderValue(value))}
            />
          </div>
        </BlockStack>

        <Divider />

        {/* Saturation & Hue */}
        <BlockStack gap="200">
          <Text as="span" variant="bodySm" fontWeight="medium">
            {t('color')}
          </Text>

          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div className={styles.sliderWrapper} onPointerUp={handleImageAdjustmentMaskCommit}>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodySm" tone="subdued">
                {t('saturation')}
              </Text>
              <Text as="span" variant="bodySm">
                {Math.round(localImageAdjustments.saturation || 0)}
              </Text>
            </InlineStack>
            <RangeSlider
              label=""
              labelHidden
              value={Math.round(localImageAdjustments.saturation || 0)}
              min={-100}
              max={100}
              step={1}
              onChange={value => handleImageAdjustmentChange('saturation', getSliderValue(value))}
            />
          </div>

          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div className={styles.sliderWrapper} onPointerUp={handleImageAdjustmentMaskCommit}>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodySm" tone="subdued">
                {t('hue')}
              </Text>
              <Text as="span" variant="bodySm">
                {Math.round(localImageAdjustments.hueRotate || 0)}°
              </Text>
            </InlineStack>
            <RangeSlider
              label=""
              labelHidden
              value={Math.round(localImageAdjustments.hueRotate || 0)}
              min={0}
              max={360}
              step={1}
              onChange={value => handleImageAdjustmentChange('hueRotate', getSliderValue(value))}
            />
          </div>
        </BlockStack>

        <Divider />

        {/* Quick Effects */}
        <BlockStack gap="200">
          <Text as="span" variant="bodySm" fontWeight="medium">
            {t('effects')}
          </Text>

          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div className={styles.sliderWrapper} onPointerUp={handleImageAdjustmentMaskCommit}>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodySm" tone="subdued">
                {t('grayscale')}
              </Text>
              <Text as="span" variant="bodySm">
                {Math.round((localImageAdjustments.grayscale || 0) * 100)}%
              </Text>
            </InlineStack>
            <RangeSlider
              label=""
              labelHidden
              value={Math.round((localImageAdjustments.grayscale || 0) * 100)}
              min={0}
              max={100}
              step={1}
              onChange={value => handleImageAdjustmentChange('grayscale', getSliderValue(value) / 100)}
            />
          </div>

          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div className={styles.sliderWrapper} onPointerUp={handleImageAdjustmentMaskCommit}>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodySm" tone="subdued">
                {t('sepia')}
              </Text>
              <Text as="span" variant="bodySm">
                {Math.round((localImageAdjustments.sepia || 0) * 100)}%
              </Text>
            </InlineStack>
            <RangeSlider
              label=""
              labelHidden
              value={Math.round((localImageAdjustments.sepia || 0) * 100)}
              min={0}
              max={100}
              step={1}
              onChange={value => handleImageAdjustmentChange('sepia', getSliderValue(value) / 100)}
            />
          </div>

          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <div className={styles.sliderWrapper} onPointerUp={handleImageAdjustmentMaskCommit}>
            <InlineStack align="space-between" blockAlign="center">
              <Text as="span" variant="bodySm" tone="subdued">
                {t('invert')}
              </Text>
              <Text as="span" variant="bodySm">
                {Math.round((localImageAdjustments.invert || 0) * 100)}%
              </Text>
            </InlineStack>
            <RangeSlider
              label=""
              labelHidden
              value={Math.round((localImageAdjustments.invert || 0) * 100)}
              min={0}
              max={100}
              step={1}
              onChange={value => handleImageAdjustmentChange('invert', getSliderValue(value) / 100)}
            />
          </div>
        </BlockStack>

        {hasImageAdjustments && (
          <Button icon={DeleteIcon} tone="critical" onClick={handleImageReset}>
            {t('clear-all-adjustments')}
          </Button>
        )}
      </BlockStack>
    )
  }

  // Render path adjustments
  return (
    <BlockStack gap="300">
      {/* Blend Mode - only shown in overlay (raster editing) mode */}
      {isOverlayMode && (
        <Select
          label={t('blend-mode')}
          labelInline
          options={BLEND_MODES.map(mode => ({ value: mode.value, label: t(mode.label) }))}
          value={blendMode}
          onChange={handleBlendModeChange}
        />
      )}

      {/* Opacity */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div className={styles.sliderWrapper} onPointerUp={handleOpacityCommit}>
        <InlineStack align="space-between" blockAlign="center">
          <Text as="span" variant="bodySm" tone="subdued">
            {t('opacity')}
          </Text>
          <Text as="span" variant="bodySm">
            {Math.round(opacity * 100)}%
          </Text>
        </InlineStack>
        <RangeSlider
          label=""
          labelHidden
          value={Math.round(opacity * 100)}
          min={0}
          max={100}
          step={1}
          onChange={value => handleOpacityChange(getSliderValue(value) / 100)}
        />
      </div>

      <Divider />

      {/* Brightness & Contrast */}
      <BlockStack gap="200">
        <Text as="span" variant="bodySm" fontWeight="medium">
          {t('brightness-contrast')}
        </Text>

        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div className={styles.sliderWrapper} onPointerUp={handleAdjustmentsCommit}>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('brightness')}
            </Text>
            <Text as="span" variant="bodySm">
              {Math.round(adjustments.brightness ?? 0)}
            </Text>
          </InlineStack>
          <RangeSlider
            label=""
            labelHidden
            value={Math.round(adjustments.brightness || 0)}
            min={-100}
            max={100}
            step={1}
            onChange={value => handleAdjustmentChange('brightness', getSliderValue(value))}
          />
        </div>

        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div className={styles.sliderWrapper} onPointerUp={handleAdjustmentsCommit}>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('contrast')}
            </Text>
            <Text as="span" variant="bodySm">
              {Math.round(adjustments.contrast ?? 0)}
            </Text>
          </InlineStack>
          <RangeSlider
            label=""
            labelHidden
            value={Math.round(adjustments.contrast || 0)}
            min={-100}
            max={100}
            step={1}
            onChange={value => handleAdjustmentChange('contrast', getSliderValue(value))}
          />
        </div>
      </BlockStack>

      <Divider />

      {/* Saturation & Hue */}
      <BlockStack gap="200">
        <Text as="span" variant="bodySm" fontWeight="medium">
          {t('color')}
        </Text>

        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div className={styles.sliderWrapper} onPointerUp={handleAdjustmentsCommit}>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('saturation')}
            </Text>
            <Text as="span" variant="bodySm">
              {Math.round(adjustments.saturation ?? 0)}
            </Text>
          </InlineStack>
          <RangeSlider
            label=""
            labelHidden
            value={Math.round(adjustments.saturation || 0)}
            min={-100}
            max={100}
            step={1}
            onChange={value => handleAdjustmentChange('saturation', getSliderValue(value))}
          />
        </div>

        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div className={styles.sliderWrapper} onPointerUp={handleAdjustmentsCommit}>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('hue')}
            </Text>
            <Text as="span" variant="bodySm">
              {Math.round(adjustments.hueRotate ?? 0)}°
            </Text>
          </InlineStack>
          <RangeSlider
            label=""
            labelHidden
            value={Math.round(adjustments.hueRotate || 0)}
            min={0}
            max={360}
            step={1}
            onChange={value => handleAdjustmentChange('hueRotate', getSliderValue(value))}
          />
        </div>
      </BlockStack>

      <Divider />

      {/* Quick Effects */}
      <BlockStack gap="200">
        <Text as="span" variant="bodySm" fontWeight="medium">
          {t('effects')}
        </Text>

        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div className={styles.sliderWrapper} onPointerUp={handleAdjustmentsCommit}>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('grayscale')}
            </Text>
            <Text as="span" variant="bodySm">
              {Math.round((adjustments.grayscale || 0) * 100)}%
            </Text>
          </InlineStack>
          <RangeSlider
            label=""
            labelHidden
            value={Math.round((adjustments.grayscale || 0) * 100)}
            min={0}
            max={100}
            step={1}
            onChange={value => handleAdjustmentChange('grayscale', getSliderValue(value) / 100)}
          />
        </div>

        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div className={styles.sliderWrapper} onPointerUp={handleAdjustmentsCommit}>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('sepia')}
            </Text>
            <Text as="span" variant="bodySm">
              {Math.round((adjustments.sepia || 0) * 100)}%
            </Text>
          </InlineStack>
          <RangeSlider
            label=""
            labelHidden
            value={Math.round((adjustments.sepia || 0) * 100)}
            min={0}
            max={100}
            step={1}
            onChange={value => handleAdjustmentChange('sepia', getSliderValue(value) / 100)}
          />
        </div>

        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div className={styles.sliderWrapper} onPointerUp={handleAdjustmentsCommit}>
          <InlineStack align="space-between" blockAlign="center">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('invert')}
            </Text>
            <Text as="span" variant="bodySm">
              {Math.round((adjustments.invert || 0) * 100)}%
            </Text>
          </InlineStack>
          <RangeSlider
            label=""
            labelHidden
            value={Math.round((adjustments.invert || 0) * 100)}
            min={0}
            max={100}
            step={1}
            onChange={value => handleAdjustmentChange('invert', getSliderValue(value) / 100)}
          />
        </div>
      </BlockStack>

      {hasAdjustments && (
        <Button icon={DeleteIcon} tone="critical" onClick={handleReset}>
          {t('clear-all-adjustments')}
        </Button>
      )}
    </BlockStack>
  )
}
