/**
 * DrawModeSection - Sidebar panel for draw mode shape selection and AI vector generation
 * Migrated from ShapesPopover to fix z-index issues with modal rendering
 */

import { useState, useMemo, useCallback } from 'react'
import { Box, Text, BlockStack, Select, Divider, InlineStack, Tabs } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import {
  FreehandIcon,
  getActiveCategories,
  getCategoryDefinition,
  getShapesByCategory,
  type ShapeCategory,
  type ShapeGroupDefinition,
  type AnyShapeDefinition,
} from '../../constants/shapes'
import { PopoverAIImageGenerator } from '~/components/AITextField/PopoverAIImageGenerator'
import type { VectorGenerationResult } from '~/components/AITextField/AIImageGenerator/types'
import { useAiCreditsStatus } from '~/hooks/useAiCreditsStatus'
import styles from './DrawModeSection.module.css'

export interface DrawModeSectionProps {
  /** Currently selected predefined shape ID (null for freehand) */
  selectedShape: string | null
  /** Callback when a shape is selected */
  onShapeSelect: (shapeId: string | null) => void
  /** Current editor mode */
  editorMode: 'edit' | 'draw'
  /** Callback to change editor mode */
  onModeChange: (mode: 'edit' | 'draw') => void
  /** Callback when AI generates a vector */
  onAIVectorGenerate?: (svgDataUri: string, svgUrl?: string) => void
  /** Callback to close the sidebar */
  onClose?: () => void
}

/** Props for the ShapeGroupSection component */
interface ShapeGroupSectionProps {
  group: ShapeGroupDefinition
  shapes: AnyShapeDefinition[]
  selectedShape: string | null
  onShapeClick: (shapeId: string) => void
  t: (key: string) => string
}

/** Visual group section with header label and shape grid */
function ShapeGroupSection({ group, shapes, selectedShape, onShapeClick, t }: ShapeGroupSectionProps) {
  if (shapes.length === 0) {
    return null
  }

  return (
    <div className={styles.shapeGroupSection}>
      <div className={styles.shapeGroupLabel}>{t(group.labelKey)}</div>
      <div className={styles.shapeGrid}>
        {shapes.map(shape => {
          const IconComponent = shape.icon
          return (
            <button
              key={shape.id}
              type="button"
              className={`${styles.shapeItem} ${selectedShape === shape.id ? styles.shapeItemSelected : ''}`}
              onClick={() => onShapeClick(shape.id)}
              title={t(shape.name)}
            >
              <IconComponent />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function DrawModeSection({
  selectedShape,
  onShapeSelect,
  editorMode,
  onModeChange,
  onAIVectorGenerate,
  onClose,
}: DrawModeSectionProps) {
  const { t } = useTranslation()
  const { hasCredits } = useAiCreditsStatus()

  // Tab state for switching between shapes view and AI generate view
  const [selectedTabIndex, setSelectedTabIndex] = useState(0)

  // Category filter state - default to 'basic' to show first group shapes initially
  const [selectedCategory, setSelectedCategory] = useState<ShapeCategory>('basic')

  // Get current category definition
  const categoryDefinition = useMemo(() => getCategoryDefinition(selectedCategory), [selectedCategory])

  // Check if current category has groups
  const hasGroups = categoryDefinition?.groups && categoryDefinition.groups.length > 0

  // Categories that have style variants - filter to show only 'cartoon' style (digital art)
  const categoriesWithStyles = ['fantasy', 'zodiac-signs', 'zodiac-animals', 'pets']

  // Filter shapes by selected category (and style for categories with variants)
  const filteredShapes = useMemo(() => {
    let shapes = getShapesByCategory(selectedCategory)

    // For categories with style variants, only show 'cartoon' style (digital art)
    if (categoriesWithStyles.includes(selectedCategory)) {
      shapes = shapes.filter(shape => !('style' in shape) || shape.style === 'cartoon')
    }

    return shapes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory])

  // Group shapes by their group property
  const groupedShapes = useMemo(() => {
    if (!hasGroups || !categoryDefinition?.groups) {
      return null
    }

    const groups: Map<string, AnyShapeDefinition[]> = new Map()

    // Initialize groups
    for (const group of categoryDefinition.groups) {
      groups.set(group.id, [])
    }

    // Add shapes to their groups
    for (const shape of filteredShapes) {
      const groupId = shape.group
      if (groupId && groups.has(groupId)) {
        groups.get(groupId)!.push(shape)
      }
    }

    return groups
  }, [filteredShapes, hasGroups, categoryDefinition?.groups])

  // Get shapes without a group (for flat display)
  const ungroupedShapes = useMemo(() => {
    if (hasGroups) {
      return filteredShapes.filter(shape => !shape.group)
    }
    return filteredShapes
  }, [filteredShapes, hasGroups])

  // Category options for select
  const categoryOptions = useMemo(() => {
    return getActiveCategories().map(cat => ({
      label: t(cat.labelKey),
      value: cat.id,
    }))
  }, [t])

  // Handle shape selection
  const handleShapeClick = useCallback(
    (shapeId: string | null) => {
      onShapeSelect(shapeId)
      // Ensure we're in draw mode
      if (editorMode !== 'draw') {
        onModeChange('draw')
      }
    },
    [onShapeSelect, editorMode, onModeChange]
  )

  // Handle freehand selection
  const handleFreehandClick = useCallback(() => {
    onShapeSelect(null)
    // Ensure we're in draw mode
    if (editorMode !== 'draw') {
      onModeChange('draw')
    }
  }, [onShapeSelect, editorMode, onModeChange])

  // Handle AI vector generation result from PopoverAIImageGenerator
  const handleSelectVector = useCallback(
    (result: VectorGenerationResult) => {
      if (!onAIVectorGenerate) return

      const svgSrc = result.svgUrl || result.svgDataUri
      if (!svgSrc) return

      // Call the callback with the generated SVG
      onAIVectorGenerate(svgSrc, result.svgUrl)

      // Close sidebar after successful generation
      onClose?.()
    },
    [onAIVectorGenerate, onClose]
  )

  // Tab definitions
  const tabs = [
    {
      id: 'shapes',
      content: t('shapes'),
      accessibilityLabel: t('shapes'),
      panelID: 'shapes-panel',
    },
    {
      id: 'ai-generate',
      content: t('ai-generate'),
      accessibilityLabel: t('ai-generate'),
      panelID: 'ai-generate-panel',
    },
  ]

  return (
    <BlockStack gap="400">
      <Tabs tabs={tabs} selected={selectedTabIndex} onSelect={setSelectedTabIndex} fitted>
        <Box paddingBlockStart="300">
          {selectedTabIndex === 0 && (
            <BlockStack gap="300">
              {/* Freehand button */}
              <button
                type="button"
                className={`${styles.shapeItem} ${styles.freehandButton} ${selectedShape === null ? styles.shapeItemSelected : ''}`}
                onClick={handleFreehandClick}
                title={t('freehand-drawing')}
              >
                <FreehandIcon />
                <span className={styles.shapeItemLabel}>{t('freehand')}</span>
              </button>

              {/* Hint for freehand */}
              <Text as="span" variant="bodySm" tone="subdued">
                {t('click-to-add-nodes-drag-for-curves')}
              </Text>

              {/* Horizontal divider labelled "Or Select Shape" */}
              <InlineStack gap="200" align="center" blockAlign="center" wrap={false}>
                <Box minWidth="0" width="100%">
                  <Divider />
                </Box>
                <span className={styles.dividerLabel}>{t('or-select-shape')}</span>
                <Box minWidth="0" width="100%">
                  <Divider />
                </Box>
              </InlineStack>

              {/* Shape category selector */}
              <Select
                label={t('category')}
                labelHidden
                options={categoryOptions}
                value={selectedCategory}
                onChange={value => setSelectedCategory(value as ShapeCategory)}
              />

              {/* List of shapes belonging to selected category */}
              {hasGroups && categoryDefinition?.groups && groupedShapes ? (
                <div className={styles.shapeGroupsContainer}>
                  {categoryDefinition.groups.map(group => (
                    <ShapeGroupSection
                      key={group.id}
                      group={group}
                      shapes={groupedShapes.get(group.id) || []}
                      selectedShape={selectedShape}
                      onShapeClick={handleShapeClick}
                      t={t}
                    />
                  ))}
                  {/* Display ungrouped shapes if any */}
                  {ungroupedShapes.length > 0 && (
                    <div className={styles.shapeGrid}>
                      {ungroupedShapes.map(shape => {
                        const IconComponent = shape.icon
                        return (
                          <button
                            key={shape.id}
                            type="button"
                            className={`${styles.shapeItem} ${selectedShape === shape.id ? styles.shapeItemSelected : ''}`}
                            onClick={() => handleShapeClick(shape.id)}
                            title={t(shape.name)}
                          >
                            <IconComponent />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Flat shape grid for categories without groups */
                <div className={styles.shapeGrid}>
                  {filteredShapes.map(shape => {
                    const IconComponent = shape.icon
                    return (
                      <button
                        key={shape.id}
                        type="button"
                        className={`${styles.shapeItem} ${selectedShape === shape.id ? styles.shapeItemSelected : ''}`}
                        onClick={() => handleShapeClick(shape.id)}
                        title={t(shape.name)}
                      >
                        <IconComponent />
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Hint for shape drawing */}
              <Text as="span" variant="bodySm" tone="subdued">
                {t('click-and-drag-to-draw-shape')}
              </Text>
            </BlockStack>
          )}

          {selectedTabIndex === 1 && (
            <BlockStack gap="300">
              {/* AI Image Generator in vector mode */}
              <PopoverAIImageGenerator
                layout="section"
                mode="vector"
                mainTextLabel={t('what-illustration-would-you-like')}
                placeholderMainTextLabel={t('describe-your-illustration-e-g-elegant-monogram-jd-floral-pattern')}
                allowCustomerToUseReferenceImage={true}
                allowCustomerToUseQuickPrompts={true}
                forceUseAIEffects={true}
                aiEffectsLayout="grid"
                showAIEffectsSearch={true}
                contentHeight="400px"
                disabledGenerate={!hasCredits}
                onSelectVector={handleSelectVector}
                onSelectImages={() => {}}
              />
            </BlockStack>
          )}
        </Box>
      </Tabs>
    </BlockStack>
  )
}
