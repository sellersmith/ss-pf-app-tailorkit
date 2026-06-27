import React, { useState } from 'react'
import { Tabs, Box } from '@shopify/polaris'
import type { ProcessingParameters, ShapeSelection } from '../../types'
import CompositeControls from './CompositeControls'
import DetectionControls from './DetectionControls'
import ShapeControls from './ShapeControls'
import styles from '../../styles.module.css'
import useScreenBreakpoints from '~/utils/hooks/use-screen-breakpoints'
import { AccordionList } from '~/components/Accordion'

interface ParameterControlsProps {
  processingParameters: ProcessingParameters
  shapeSelections: ShapeSelection[]
  templatePositioningMode: 'fit' | 'fill'
  showAdvancedSettings: boolean
  updateParameter: (key: keyof ProcessingParameters, value: any) => void
  onTemplatePositioningModeChange: (mode: 'fit' | 'fill') => void
  /** When true, skip the tab UI and render only CompositeControls directly.
   *  Used in modal mode where Detection/Shape Selection tabs are hidden. */
  compositeOnlyMode?: boolean
  t: (key: string) => string
}

export default function ParameterControls({
  processingParameters,
  shapeSelections,
  templatePositioningMode,
  showAdvancedSettings,
  updateParameter,
  onTemplatePositioningModeChange,
  compositeOnlyMode = false,
  t,
}: ParameterControlsProps) {
  const { isMobileView } = useScreenBreakpoints()
  const [selectedTab, setSelectedTab] = useState(0)

  // Only count active shapes, excluding deleted markers
  const hasShapeSelections = shapeSelections.filter(shape => shape.width > 0 && shape.height > 0).length > 0

  // Show fallback parameter whenever shape selections exist
  const shouldShowFallbackParameter = hasShapeSelections

  // Mobile accordion items
  const accordionItems = []

  // Composite accordion item (always visible — Fit/Fill shown regardless of template)
  accordionItems.push({
    id: 'composite',
    label: t('composite'),
    open: false,
    content: (
      <CompositeControls
        templatePositioningMode={templatePositioningMode}
        onTemplatePositioningModeChange={onTemplatePositioningModeChange}
        hasShapeSelections={hasShapeSelections}
        shouldShowFallbackParameter={shouldShowFallbackParameter}
        processingParameters={processingParameters}
        updateParameter={updateParameter}
        t={t}
      />
    ),
  })

  // Detection accordion item (always visible)
  accordionItems.push({
    id: 'detection',
    label: t('detection'),
    open: false,
    content: <DetectionControls params={processingParameters} updateParameter={updateParameter} t={t} />,
  })

  // Shape Selection accordion item (only if shape selections exist and advanced settings enabled)
  if (showAdvancedSettings && hasShapeSelections) {
    accordionItems.push({
      id: 'shape-selections',
      label: t('shape-selections'),
      open: false,
      content: <ShapeControls params={processingParameters} updateParameter={updateParameter} t={t} />,
    })
  }

  // Composite-only mode: skip tabs/accordions entirely and render CompositeControls directly.
  // Used in modal (unified editor) so Detection/Shape Selection params stay at their
  // defaults — the mask is generated with those defaults and the user never sees them.
  // Applies on both mobile and desktop so all non-composite controls stay hidden.
  if (compositeOnlyMode) {
    return (
      <Box paddingBlock="200" paddingInline="300">
        <CompositeControls
          templatePositioningMode={templatePositioningMode}
          onTemplatePositioningModeChange={onTemplatePositioningModeChange}
          hasShapeSelections={hasShapeSelections}
          shouldShowFallbackParameter={shouldShowFallbackParameter}
          processingParameters={processingParameters}
          updateParameter={updateParameter}
          t={t}
        />
      </Box>
    )
  }

  // Mobile layout with accordions
  if (isMobileView) {
    return (
      <div className={styles.mobileParameterControls}>
        <AccordionList items={accordionItems as any} rememberState={true} />
      </div>
    )
  }

  // Desktop layout with tabs
  const tabs = []

  // Composite tab (always visible — Fit/Fill shown regardless of template)
  tabs.push({
    id: 'composite',
    content: t('composite'),
    panelID: 'composite-panel',
  })

  // Detection tab (always visible)
  tabs.push({
    id: 'detection',
    content: t('detection'),
    panelID: 'detection-panel',
  })

  // Shape Selection tab (only if shape selections exist and advanced settings enabled)
  if (showAdvancedSettings && hasShapeSelections) {
    tabs.push({
      id: 'shape-selections',
      content: t('shape-selections'),
      panelID: 'shape-selections-panel',
    })
  }

  const activeTab = tabs[selectedTab]?.id

  return (
    <div className={styles.settingsContainer}>
      <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
        <div className={styles.tabContentContainer}>
          <Box paddingBlock="200" paddingInline="300">
            {activeTab === 'composite' && (
              <CompositeControls
                templatePositioningMode={templatePositioningMode}
                onTemplatePositioningModeChange={onTemplatePositioningModeChange}
                hasShapeSelections={hasShapeSelections}
                shouldShowFallbackParameter={shouldShowFallbackParameter}
                processingParameters={processingParameters}
                updateParameter={updateParameter}
                t={t}
              />
            )}
            {activeTab === 'detection' && (
              <DetectionControls params={processingParameters} updateParameter={updateParameter} t={t} />
            )}
            {activeTab === 'shape-selections' && (
              <ShapeControls params={processingParameters} updateParameter={updateParameter} t={t} />
            )}
          </Box>
        </div>
      </Tabs>
    </div>
  )
}
