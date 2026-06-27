/* eslint-disable max-len, max-lines */
/**
 * FiltersSection - Filter effects controls for the sidebar
 *
 * Unified tabbed UI with:
 * - Path Filters tab (first) - printing technique presets for vector paths
 * - Image Filters tab (second) - filter presets for raster background images
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Box,
  Button,
  BlockStack,
  InlineStack,
  InlineGrid,
  Text,
  RangeSlider,
  Checkbox,
  Tabs,
  Select,
  Banner,
} from '@shopify/polaris'
import { DeleteIcon } from '@shopify/polaris-icons'
import type { FilterDef } from '../../types'
import { generateDefId } from '../../utils/svg'
import {
  IMAGE_FILTER_PRESETS,
  getFilterPresetById,
  getDefaultParams,
  PATH_FILTER_PRESETS_BY_CATEGORY,
  getPathFilterPresetById,
  getPathFilterDefaultParams,
  buildPathFilterPrimitives,
  FOIL_COLORS,
  COLOR_OVERRIDING_FILTER_IDS,
} from '../../utils/filters'
import type { PathFilterPreset, PathFilterPresetParams, PathFilterCategory } from '../../utils/filters'
import { useTranslation } from 'react-i18next'
import type { FiltersSectionProps } from './types'
import { ImageFilterPresetIcon, PathFilterPresetIcon } from './FilterPresetIcons'
import styles from './styles.module.css'

// Filters designed for stroke-based paths (line work) that don't work well with fill-only shapes
const STROKE_BASED_FILTER_IDS = ['diamond-drag']
// Filters designed for fill-based shapes that don't work well with stroke-only shapes
const FILL_BASED_FILTER_IDS = ['enamel-fill']

type RangeSliderValue = number | [number, number]

function getSliderValue(value: RangeSliderValue): number {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Image Filters Tab Content
 * Shows filter preset thumbnails for raster background images
 */
function ImageFilterPresets({
  imageColorAdjustments,
  onImageFilterPresetChange,
  onImageFilterPresetCommit,
  onImageFilterParamChange,
}: {
  imageColorAdjustments?: FiltersSectionProps['imageColorAdjustments']
  onImageFilterPresetChange?: FiltersSectionProps['onImageFilterPresetChange']
  onImageFilterPresetCommit?: FiltersSectionProps['onImageFilterPresetCommit']
  onImageFilterParamChange?: FiltersSectionProps['onImageFilterParamChange']
}) {
  const { t } = useTranslation()
  const activePresetId = imageColorAdjustments?.filterPresetId ?? null
  const activePreset = activePresetId ? getFilterPresetById(activePresetId) : null
  const currentParams
    = imageColorAdjustments?.filterPresetParams ?? (activePreset ? getDefaultParams(activePreset) : {})

  const handlePresetClick = useCallback(
    (presetId: string) => {
      if (!onImageFilterPresetChange) return
      if (activePresetId === presetId) {
        onImageFilterPresetChange(null)
      } else {
        onImageFilterPresetChange(presetId)
      }
      onImageFilterPresetCommit?.()
    },
    [activePresetId, onImageFilterPresetChange, onImageFilterPresetCommit]
  )

  const handleParamChange = useCallback(
    (paramKey: string, value: RangeSliderValue) => {
      onImageFilterParamChange?.(paramKey, getSliderValue(value))
    },
    [onImageFilterParamChange]
  )

  const formatParamValue = (param: { unit?: '%' | 'px' | '' }, value: number): string => {
    if (param.unit === '%') return `${Math.round(value)}%`
    if (param.unit === 'px') return `${value.toFixed(1)}px`
    return value.toFixed(2)
  }

  return (
    <BlockStack gap="400">
      <InlineGrid columns={2} gap="200">
        {IMAGE_FILTER_PRESETS.map(preset => (
          <button
            key={preset.id}
            type="button"
            className={`${styles.presetThumbnail} ${activePresetId === preset.id ? styles.presetThumbnailActive : ''}`}
            onClick={() => handlePresetClick(preset.id)}
            aria-pressed={activePresetId === preset.id}
          >
            <div className={styles.presetPreview}>
              <ImageFilterPresetIcon presetId={preset.id} cssPreview={preset.cssPreview} />
            </div>
            <Text as="span" variant="bodySm">
              {t(preset.nameKey)}
            </Text>
          </button>
        ))}
      </InlineGrid>

      {activePreset && activePreset.parameters && activePreset.parameters.length > 0 && (
        <BlockStack gap="300">
          {activePreset.parameters.map(param => {
            const value = currentParams[param.key] ?? param.defaultValue

            if (param.type === 'toggle') {
              return (
                <Checkbox
                  key={param.key}
                  label={t(param.labelKey)}
                  checked={Boolean(value)}
                  onChange={(checked: boolean) => {
                    onImageFilterParamChange?.(param.key, checked ? 1 : 0)
                    onImageFilterPresetCommit?.()
                  }}
                />
              )
            }

            return (
              <div key={param.key} className={styles.sliderWrapper} onPointerUp={() => onImageFilterPresetCommit?.()}>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t(param.labelKey)}
                  </Text>
                  <Text as="span" variant="bodySm">
                    {formatParamValue(param, value)}
                  </Text>
                </InlineStack>
                <RangeSlider
                  label=""
                  labelHidden
                  value={value}
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  onChange={v => handleParamChange(param.key, v)}
                />
              </div>
            )
          })}
        </BlockStack>
      )}

      {activePresetId && (
        <Button
          icon={DeleteIcon}
          tone="critical"
          onClick={() => {
            onImageFilterPresetChange?.(null)
            onImageFilterPresetCommit?.()
          }}
        >
          {t('remove-filter')}
        </Button>
      )}
    </BlockStack>
  )
}

/**
 * Path Filters Tab Content
 * Shows printing technique presets for vector paths
 */
function PathFilterPresets({
  selectedPath,
  defs,
  hasPaths,
  selectedPathHasAdjustments,
  onFilterCreate,
  onFilterUpdate,
  onFilterApply,
  onFilterApplyToAll,
  onFilterDelete,
  onFillChange,
  onStrokeChange,
  onSwitchSection,
}: {
  selectedPath: FiltersSectionProps['selectedPath']
  defs: FiltersSectionProps['defs']
  hasPaths?: boolean
  selectedPathHasAdjustments?: boolean
  onFilterCreate: FiltersSectionProps['onFilterCreate']
  onFilterUpdate: FiltersSectionProps['onFilterUpdate']
  onFilterApply: FiltersSectionProps['onFilterApply']
  onFilterApplyToAll?: FiltersSectionProps['onFilterApplyToAll']
  onFilterDelete: FiltersSectionProps['onFilterDelete']
  onFillChange?: FiltersSectionProps['onFillChange']
  onStrokeChange?: FiltersSectionProps['onStrokeChange']
  onSwitchSection?: FiltersSectionProps['onSwitchSection']
}) {
  const { t } = useTranslation()
  const [selectedCategory, setSelectedCategory] = useState<PathFilterCategory>('jewelry')
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  const [activeParams, setActiveParams] = useState<PathFilterPresetParams>({})
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null)

  // Track when we're in the middle of applying a preset to avoid useEffect resetting state
  const isApplyingPresetRef = useRef(false)

  // Whether we're applying to all paths (no specific path selected but paths exist)
  // Only true when hasPaths is explicitly true (not undefined)
  const isApplyingToAll = !selectedPath && hasPaths === true

  // Sync state with the selected path's filter when path changes
  // Skip sync when the local activeFilterId matches what we just applied
  useEffect(() => {
    // Skip sync if we just applied a preset - let the local state take precedence
    // We check isApplyingPresetRef AND verify activeFilterId is set (meaning we just applied something)
    if (isApplyingPresetRef.current && activeFilterId) {
      // Only reset the flag when the path's filterId catches up to our local state
      const pathFilterId = selectedPath?.style?.filterId
      if (pathFilterId === activeFilterId) {
        isApplyingPresetRef.current = false
      }
      return
    }

    if (!selectedPath) {
      // No path selected - only reset if we're not in apply-to-all mode
      // In apply-to-all mode, the UI state is managed by handlePresetClick
      // and should not be reset here
      if (hasPaths !== true) {
        setActivePresetId(null)
        setActiveParams({})
        setActiveFilterId(null)
      }
      // When hasPaths is true but no path selected, keep current UI state
      // to show the active filter controls for apply-to-all mode
      return
    }

    // filterId is inside the style property, not at the top level
    const pathFilterId = selectedPath.style?.filterId
    if (!pathFilterId) {
      // Path has no filter - reset state
      setActivePresetId(null)
      setActiveParams({})
      setActiveFilterId(null)
      return
    }

    // Find the filter definition in defs (filters is a Map)
    const filterDef = defs.filters.get(pathFilterId)
    if (filterDef && filterDef.presetId) {
      // Restore state from the filter definition
      const preset = getPathFilterPresetById(filterDef.presetId)
      if (preset) {
        setActivePresetId(filterDef.presetId)
        setActiveParams(filterDef.presetParams ?? getPathFilterDefaultParams(preset))
        setActiveFilterId(pathFilterId)
        // Switch to the correct category
        setSelectedCategory(preset.category)
      }
    } else {
      // Filter exists but no preset info - just track the filter ID
      setActivePresetId(null)
      setActiveParams({})
      setActiveFilterId(pathFilterId)
    }
  }, [selectedPath, defs.filters, hasPaths, activeFilterId])

  // Category options for the dropdown
  const categoryOptions = useMemo(
    () => [
      { label: t('jewelry-techniques'), value: 'jewelry' },
      { label: t('leather-techniques'), value: 'leather' },
    ],
    [t]
  )

  const handleCategoryChange = useCallback((value: string) => {
    setSelectedCategory(value as PathFilterCategory)
  }, [])

  const handlePresetClick = useCallback(
    (preset: PathFilterPreset) => {
      // Need either a selected path or hasPaths for apply-to-all
      // Only block if hasPaths is explicitly false (no paths exist)
      if (!selectedPath && hasPaths === false) return

      // Mark that we're applying a preset to prevent useEffect from resetting state
      isApplyingPresetRef.current = true

      if (activePresetId === preset.id) {
        // Toggle off - remove filter reference from selected path(s)
        // Don't delete from defs - other paths might still reference it
        if (activeFilterId) {
          if (isApplyingToAll && onFilterApplyToAll) {
            onFilterApplyToAll(null)
          } else {
            onFilterApply(null)
          }
          setActiveFilterId(null)
        }
        setActivePresetId(null)
        setActiveParams({})
      } else {
        // Note: We do NOT delete the old filter here because other paths might still
        // reference it. The old filter definition stays in defs (harmless) and the
        // selected path(s) will simply get a new filterId assigned.
        // Filter cleanup can happen during save/export if needed.

        // Note: Fill-based filters (like enamel-fill) work best with filled shapes.
        // We do NOT auto-convert here - instead, a warning banner is shown to let the user decide.
        // The banner provides a "Replace with fill" button that calls handleReplaceWithFill.

        const defaultParams = getPathFilterDefaultParams(preset)

        // Check shape characteristics
        const hasFill = selectedPath?.style?.fill && selectedPath.style.fill.type !== 'none'
        const hasStroke = selectedPath?.style?.stroke && selectedPath.style.stroke.type !== 'none'

        // For debossing preset on fill-only shapes:
        // Use the fill-only algorithm which creates proper inset shadows.
        // User should set fill color to match the leather surface for realistic effect.
        if (preset.id === 'debossing' && selectedPath && !hasStroke) {
          defaultParams._isFillOnly = 1
          // Ensure there's a fill for the filter to work with
          if (!hasFill && onFillChange) {
            onFillChange('#808080')
          }
        }
        // For other leather techniques (embossing, etc.), ensure there's a fill
        // The filter uses SourceGraphic/SourceAlpha which need actual pixel content.
        else if (preset.category === 'leather' && preset.id !== 'debossing' && selectedPath && onFillChange) {
          const hasNoFill = !selectedPath.style?.fill || selectedPath.style.fill.type === 'none'
          if (hasNoFill) {
            onFillChange('#808080')
          }
        }

        const newFilterId = generateDefId('filter', defs)

        // Apply filter immediately - include preset metadata for state restoration
        const primitives = buildPathFilterPrimitives(preset, defaultParams)
        const newFilter: FilterDef = {
          id: newFilterId,
          primitives,
          presetId: preset.id,
          presetParams: defaultParams,
        }
        onFilterCreate(newFilter)

        // Apply to all paths or just selected path
        if (isApplyingToAll && onFilterApplyToAll) {
          onFilterApplyToAll(newFilterId)
        } else {
          onFilterApply(newFilterId)
        }

        setActivePresetId(preset.id)
        setActiveParams(defaultParams)
        setActiveFilterId(newFilterId)
      }
    },
    [
      selectedPath,
      hasPaths,
      isApplyingToAll,
      activePresetId,
      activeFilterId,
      defs,
      onFilterCreate,
      onFilterApply,
      onFilterApplyToAll,
      onFillChange,
    ]
  )

  const handleParamChange = useCallback(
    (paramKey: string, value: RangeSliderValue) => {
      if (!activePresetId || !activeFilterId) return

      const newParams = { ...activeParams, [paramKey]: getSliderValue(value) }
      setActiveParams(newParams)

      // Rebuild filter with new params
      const preset = getPathFilterPresetById(activePresetId)
      if (!preset) return

      const primitives = buildPathFilterPrimitives(preset, newParams)

      // Update filter definition in place - all paths referencing this filter ID
      // will automatically use the updated primitives (no need to re-apply)
      onFilterUpdate(activeFilterId, {
        primitives,
        presetParams: newParams,
      })
    },
    [activePresetId, activeFilterId, activeParams, onFilterUpdate]
  )

  const handleRemoveFilter = useCallback(() => {
    if (activeFilterId) {
      // Remove filter reference from selected path(s) but don't delete the filter
      // definition from defs - other paths might still reference it
      if (isApplyingToAll && onFilterApplyToAll) {
        onFilterApplyToAll(null)
      } else {
        onFilterApply(null)
      }
      setActiveFilterId(null)
    }
    setActivePresetId(null)
    setActiveParams({})
  }, [activeFilterId, isApplyingToAll, onFilterApply, onFilterApplyToAll])

  // Extract fill/stroke state for dependency tracking (ensures useMemo recomputes when style changes)
  const fillType = selectedPath?.style?.fill?.type
  const strokeType = selectedPath?.style?.stroke?.type

  // Check for filter/shape type mismatches and info banners (must be before early returns for React hooks)
  const {
    isStrokeBased,
    showStrokeFilterWarning,
    showFillFilterWarning,
    leatherSurfaceInfoType,
    showColorOverrideInfo,
  } = useMemo(() => {
    const none = {
      isStrokeBased: false,
      showStrokeFilterWarning: false,
      showFillFilterWarning: false,
      leatherSurfaceInfoType: null as 'fill' | 'stroke' | null,
      showColorOverrideInfo: false,
    }
    if (!activePresetId) return none
    // Color override info should show when the filter is applied (even in apply-to-all mode)
    const isColorOverriding = (COLOR_OVERRIDING_FILTER_IDS as readonly string[]).includes(activePresetId)
    if (!selectedPath) {
      return { ...none, showColorOverrideInfo: isColorOverriding }
    }
    const hasFill = fillType && fillType !== 'none'
    const hasStroke = strokeType && strokeType !== 'none'
    const isStrokeBased = STROKE_BASED_FILTER_IDS.includes(activePresetId)
    const isFillBased = FILL_BASED_FILTER_IDS.includes(activePresetId)
    // Determine leather surface info type for debossing/embossing
    // These filters work best when fill/stroke color matches the leather surface
    // Fill-only: guide user to set fill color; Stroke-only: guide user to set stroke color
    let leatherSurfaceInfoType: 'fill' | 'stroke' | null = null
    if (activePresetId === 'debossing' || activePresetId === 'embossing') {
      if (hasFill && !hasStroke) leatherSurfaceInfoType = 'fill'
      else if (hasStroke && !hasFill) leatherSurfaceInfoType = 'stroke'
    }
    return {
      isStrokeBased,
      showStrokeFilterWarning: isStrokeBased && hasFill && !hasStroke,
      showFillFilterWarning: isFillBased && !hasFill, // Show warning when no fill (regardless of stroke)
      leatherSurfaceInfoType,
      showColorOverrideInfo: isColorOverriding,
    }
  }, [activePresetId, selectedPath, fillType, strokeType])

  // Replace fill with stroke for stroke-based filters on fill-only shapes
  const handleReplaceWithStroke = useCallback(() => {
    if (!selectedPath || !onFillChange || !onStrokeChange) return
    const fillColor = selectedPath.style?.fill?.type === 'color' ? selectedPath.style.fill.color : '#000000'
    onFillChange('none')
    onStrokeChange(fillColor)
  }, [selectedPath, onFillChange, onStrokeChange])

  // Switch to stroke section to pick stroke color
  const handleSelectStrokeColor = useCallback(() => onSwitchSection?.('stroke'), [onSwitchSection])

  // Switch to fill section to pick fill color (used for debossing)
  const handleSelectFillColor = useCallback(() => onSwitchSection?.('fill'), [onSwitchSection])

  // Replace stroke with fill for fill-based filters on stroke-only shapes
  const handleReplaceWithFill = useCallback(() => {
    if (!selectedPath || !onFillChange || !onStrokeChange) return
    const strokeColor = selectedPath.style?.stroke?.type === 'color' ? selectedPath.style.stroke.color : '#808080'
    onStrokeChange('none')
    onFillChange(strokeColor)
  }, [selectedPath, onFillChange, onStrokeChange])

  // No paths in workspace at all - show empty state
  // Only show this when hasPaths is explicitly false, not when undefined
  if (hasPaths === false) {
    return (
      <Box padding="300">
        <Text as="p" tone="subdued">
          {t('no-paths-available')}
        </Text>
      </Box>
    )
  }

  // Show remove-only UI when adjustments are applied to the selected path
  // This handles legacy SVGs that have both filters and adjustments applied
  const pathHasFilter = Boolean(selectedPath?.style?.filterId)
  if (selectedPathHasAdjustments && selectedPath) {
    return (
      <Box padding="300">
        <BlockStack gap="300">
          <Text as="p" tone="subdued">
            {t(
              'filters-are-unavailable-when-adjustments-are-applied-to-the-selected-path-remove-the-adjustments-to-enable-filters'
            )}
          </Text>
          {pathHasFilter && (
            <Button icon={DeleteIcon} tone="critical" onClick={handleRemoveFilter}>
              {t('remove-filter')}
            </Button>
          )}
        </BlockStack>
      </Box>
    )
  }

  const activePreset = activePresetId ? getPathFilterPresetById(activePresetId) : null
  const presetsToShow = PATH_FILTER_PRESETS_BY_CATEGORY[selectedCategory]

  const formatParamValue = (param: { unit?: '%' | 'px' | '°' | '' }, value: number): string => {
    if (param.unit === '%') return `${Math.round(value)}%`
    if (param.unit === 'px') return `${value.toFixed(1)}px`
    if (param.unit === '°') return `${Math.round(value)}°`
    return value.toFixed(1)
  }

  return (
    <BlockStack gap="400">
      {/* Apply to all paths hint */}
      {isApplyingToAll && (
        <Banner tone="info">
          <Text as="p" variant="bodySm">
            {t('filters-will-be-applied-to-all-paths')}
          </Text>
        </Banner>
      )}

      {/* Technique Category Selector */}
      <Select
        labelHidden={true}
        label={t('technique-category')}
        options={categoryOptions}
        value={selectedCategory}
        onChange={handleCategoryChange}
      />

      {/* Technique Presets Grid */}
      <InlineGrid columns={2} gap="200">
        {presetsToShow.map(preset => (
          <button
            key={preset.id}
            type="button"
            className={`${styles.presetThumbnail} ${activePresetId === preset.id ? styles.presetThumbnailActive : ''}`}
            onClick={() => handlePresetClick(preset)}
            aria-pressed={activePresetId === preset.id}
          >
            <div className={styles.presetPreview}>
              <PathFilterPresetIcon presetId={preset.id} />
            </div>
            <Text as="span" variant="bodySm">
              {t(preset.nameKey)}
            </Text>
          </button>
        ))}
      </InlineGrid>

      {/* Filter type banners - warnings for mismatches, info for correct usage */}
      {showStrokeFilterWarning ? (
        <Banner tone="warning">
          <BlockStack gap="200">
            <Text as="p" variant="bodySm">
              {t('best-for-line-work-fill-only-shapes-may-not-display-correctly')}
            </Text>
            <Button onClick={handleReplaceWithStroke}>{t('replace-with-stroke')}</Button>
          </BlockStack>
        </Banner>
      ) : (
        isStrokeBased && (
          <Banner tone="info">
            <BlockStack gap="200">
              <Text as="p" variant="bodySm">
                {t('best-for-line-work-with-a-color-similar-to-the-material-surface')}
              </Text>
              <Button onClick={handleSelectStrokeColor}>{t('select-stroke-color')}</Button>
            </BlockStack>
          </Banner>
        )
      )}
      {showFillFilterWarning && (
        <Banner tone="warning">
          <BlockStack gap="200">
            <Text as="p" variant="bodySm">
              {t('best-for-filled-shapes-shapes-without-fill-may-not-display-correctly')}
            </Text>
            <Button onClick={handleReplaceWithFill}>{t('replace-with-fill')}</Button>
          </BlockStack>
        </Banner>
      )}
      {leatherSurfaceInfoType && (
        <Banner tone="info">
          <BlockStack gap="200">
            <Text as="p" variant="bodySm">
              {leatherSurfaceInfoType === 'fill'
                ? t('for-best-results-set-the-fill-color-to-match-the-leather-surface')
                : t('for-best-results-set-the-stroke-color-to-match-the-leather-surface')}
            </Text>
            <Button onClick={leatherSurfaceInfoType === 'fill' ? handleSelectFillColor : handleSelectStrokeColor}>
              {leatherSurfaceInfoType === 'fill' ? t('select-fill-color') : t('select-stroke-color')}
            </Button>
          </BlockStack>
        </Banner>
      )}
      {showColorOverrideInfo && (
        <Banner tone="info">
          <Text as="p" variant="bodySm">
            {t('this-filter-uses-computed-colors-shape-fill-and-stroke-colors-will-not-affect-the-appearance')}
          </Text>
        </Banner>
      )}

      {/* Parameter Controls */}
      {activePreset && activePreset.parameters && activePreset.parameters.length > 0 && (
        <BlockStack gap="300">
          {activePreset.parameters.map(param => {
            const value = activeParams[param.key] ?? param.defaultValue

            if (param.type === 'toggle') {
              return (
                <Checkbox
                  key={param.key}
                  label={t(param.labelKey)}
                  checked={Boolean(value)}
                  onChange={(checked: boolean) => {
                    handleParamChange(param.key, checked ? 1 : 0)
                  }}
                />
              )
            }

            // Special handling for foilColor parameter - show as color swatches
            if (param.key === 'foilColor') {
              const selectedColorName = FOIL_COLORS[value as keyof typeof FOIL_COLORS]?.name ?? 'Gold'
              return (
                <BlockStack key={param.key} gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">
                      {t(param.labelKey)}
                    </Text>
                    <Text as="span" variant="bodySm">
                      {t(selectedColorName)}
                    </Text>
                  </InlineStack>
                  <div className={styles.foilColorSwatches}>
                    {Object.entries(FOIL_COLORS).map(([id, color]) => {
                      const colorId = parseInt(id, 10)
                      const isHolographic = colorId === 10
                      const isActive = value === colorId
                      const swatchClasses = [
                        styles.foilColorSwatch,
                        isActive && styles.foilColorSwatchActive,
                        isHolographic && styles.foilColorSwatchHolographic,
                      ]
                        .filter(Boolean)
                        .join(' ')
                      return (
                        <button
                          key={id}
                          type="button"
                          className={swatchClasses}
                          style={!isHolographic ? { background: color.mid } : undefined}
                          onClick={() => handleParamChange(param.key, colorId)}
                          title={t(color.name)}
                          aria-label={t(color.name)}
                          aria-pressed={isActive}
                        />
                      )
                    })}
                  </div>
                </BlockStack>
              )
            }

            return (
              <div key={param.key} className={styles.sliderWrapper}>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t(param.labelKey)}
                  </Text>
                  <Text as="span" variant="bodySm">
                    {formatParamValue(param, value)}
                  </Text>
                </InlineStack>
                <RangeSlider
                  label=""
                  labelHidden
                  value={value}
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  onChange={v => handleParamChange(param.key, v)}
                />
              </div>
            )
          })}
        </BlockStack>
      )}

      {/* Remove Filter Button */}
      {activeFilterId && (
        <Button icon={DeleteIcon} tone="critical" onClick={handleRemoveFilter}>
          {t('remove-filter')}
        </Button>
      )}
    </BlockStack>
  )
}

/**
 * Main FiltersSection Component
 * Unified tabbed interface for both path and image filters
 */
export default function FiltersSection({
  selectedPath,
  defs,
  selectedPathHasAdjustments,
  onFilterCreate,
  onFilterUpdate,
  onFilterDelete,
  onFilterApply,
  hasPaths,
  onFilterApplyToAll,
  onFillChange,
  onStrokeChange,
  onSwitchSection,
  isOverlayMode,
  imageColorAdjustments,
  onImageFilterPresetChange,
  onImageFilterPresetCommit,
  onImageFilterParamChange,
}: FiltersSectionProps) {
  const { t } = useTranslation()
  const [selectedTabIndex, setSelectedTabIndex] = useState(0)

  // Auto-switch to Image Filters tab when no paths exist and in overlay mode
  useEffect(() => {
    if (hasPaths === false && isOverlayMode) {
      setSelectedTabIndex(1)
    }
  }, [hasPaths, isOverlayMode])

  // Tab definitions - Path Filters first, Image Filters second
  const tabs = [
    {
      id: 'path-filters',
      content: t('path-filters'),
      accessibilityLabel: t('path-filters'),
      panelID: 'path-filters-panel',
    },
    {
      id: 'image-filters',
      content: t('image-filters'),
      accessibilityLabel: t('image-filters'),
      panelID: 'image-filters-panel',
      disabled: !isOverlayMode,
    },
  ]

  // Handle tab selection - prevent selecting disabled tab
  const handleTabSelect = useCallback(
    (index: number) => {
      if (index === 1 && !isOverlayMode) {
        return // Don't switch to disabled Image Filters tab
      }
      setSelectedTabIndex(index)
    },
    [isOverlayMode]
  )

  // In SVG-editing mode (not overlay mode), show path filters directly without tabs
  if (!isOverlayMode) {
    return (
      <PathFilterPresets
        selectedPath={selectedPath}
        defs={defs}
        hasPaths={hasPaths}
        selectedPathHasAdjustments={selectedPathHasAdjustments}
        onFilterCreate={onFilterCreate}
        onFilterUpdate={onFilterUpdate}
        onFilterApply={onFilterApply}
        onFilterApplyToAll={onFilterApplyToAll}
        onFilterDelete={onFilterDelete}
        onFillChange={onFillChange}
        onStrokeChange={onStrokeChange}
        onSwitchSection={onSwitchSection}
      />
    )
  }

  // In overlay mode (raster image editing), show tabbed interface
  return (
    <BlockStack gap="400">
      <Tabs tabs={tabs} selected={selectedTabIndex} onSelect={handleTabSelect} fitted>
        <Box paddingBlockStart="400">
          {selectedTabIndex === 0 && (
            <PathFilterPresets
              selectedPath={selectedPath}
              defs={defs}
              hasPaths={hasPaths}
              selectedPathHasAdjustments={selectedPathHasAdjustments}
              onFilterCreate={onFilterCreate}
              onFilterUpdate={onFilterUpdate}
              onFilterApply={onFilterApply}
              onFilterApplyToAll={onFilterApplyToAll}
              onFilterDelete={onFilterDelete}
              onFillChange={onFillChange}
              onStrokeChange={onStrokeChange}
              onSwitchSection={onSwitchSection}
            />
          )}
          {selectedTabIndex === 1 && (
            <ImageFilterPresets
              imageColorAdjustments={imageColorAdjustments}
              onImageFilterPresetChange={onImageFilterPresetChange}
              onImageFilterPresetCommit={onImageFilterPresetCommit}
              onImageFilterParamChange={onImageFilterParamChange}
            />
          )}
        </Box>
      </Tabs>
    </BlockStack>
  )
}
