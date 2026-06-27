import React, { useState } from 'react'
import { Tabs, Box } from '@shopify/polaris'
import type { VectorConversionParameters, ShapeSelection } from '../../types'
import BasicSettings from './BasicSettings'
import AdvancedSettings from './AdvancedSettings'
import styles from '../../styles.module.css'
import useDevices from '~/utils/hooks/useDevice'
import { AccordionList } from '~/components/Accordion'

interface ParameterControlsProps {
  processingParameters: VectorConversionParameters
  shapeSelections: ShapeSelection[]
  showAdvancedSettings: boolean
  updateParameter: (key: keyof VectorConversionParameters, value: any) => void
  onQualityPresetChange?: (preset: 'low' | 'medium' | 'high') => void
  t: (key: string) => string
}

export default function ParameterControls({
  processingParameters,
  shapeSelections,
  showAdvancedSettings,
  updateParameter,
  onQualityPresetChange,
  t,
}: ParameterControlsProps) {
  const { isMobileView } = useDevices()
  const [selectedTab, setSelectedTab] = useState(0)

  // Mobile accordion items
  const accordionItems = []

  // Basic Settings accordion item (always visible, open by default)
  accordionItems.push({
    id: 'basic-settings',
    label: t('basic-settings'),
    open: true,
    content: (
      <BasicSettings
        params={processingParameters}
        updateParameter={updateParameter}
        onQualityPresetChange={onQualityPresetChange}
        t={t}
      />
    ),
  })

  // Advanced Settings accordion item (only if advanced settings enabled)
  if (showAdvancedSettings) {
    accordionItems.push({
      id: 'advanced-settings',
      label: t('advanced-settings'),
      open: false,
      content: <AdvancedSettings params={processingParameters} updateParameter={updateParameter} t={t} />,
    })
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

  // Basic Settings tab (always visible)
  tabs.push({
    id: 'basic-settings',
    content: t('basic-settings'),
    panelID: 'basic-settings-panel',
  })

  // Advanced Settings tab (only if advanced settings enabled)
  if (showAdvancedSettings) {
    tabs.push({
      id: 'advanced-settings',
      content: t('advanced-settings'),
      panelID: 'advanced-settings-panel',
    })
  }

  const activeTab = tabs[selectedTab]?.id

  return (
    <div className={styles.settingsContainer}>
      <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
        <div className={styles.tabContentContainer}>
          <Box paddingBlock="200" paddingInline="300">
            {activeTab === 'basic-settings' && (
              <BasicSettings
                params={processingParameters}
                updateParameter={updateParameter}
                onQualityPresetChange={onQualityPresetChange}
                t={t}
              />
            )}
            {activeTab === 'advanced-settings' && (
              <AdvancedSettings params={processingParameters} updateParameter={updateParameter} t={t} />
            )}
          </Box>
        </div>
      </Tabs>
    </div>
  )
}
