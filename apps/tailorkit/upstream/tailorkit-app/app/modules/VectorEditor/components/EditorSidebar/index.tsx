/**
 * EditorSidebar - Collapsible sidebar/bottom panel content for VectorEditor styling controls
 * The responsive wrapper (sidebarColumn/bottomPanel) is handled by VectorEditor.tsx
 */

import { Button, Text } from '@shopify/polaris'
import { XIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import FillSection from './FillSection'
import StrokeSection from './StrokeSection'
import FiltersSection from './FiltersSection'
import AdjustmentsSection from './AdjustmentsSection'
import DrawModeSection from './DrawModeSection'
import EditModeSection from './EditModeSection'
import GuideImageSection from './GuideImageSection'
import type { EditorSidebarProps, SidebarSection } from './types'
import styles from './styles.module.css'

const SECTION_TITLES: Record<Exclude<SidebarSection, null>, string> = {
  fill: 'Fill',
  stroke: 'Stroke',
  filters: 'Filters',
  adjustments: 'Adjustments',
  draw: 'draw-mode',
  edit: 'edit-mode',
  'guide-image': 'Guide Image',
}

export default function EditorSidebar({
  activeSection,
  onClose,
  fillProps,
  strokeProps,
  filtersProps,
  adjustmentsProps,
  drawModeProps,
  editModeProps,
  guideImageProps,
}: EditorSidebarProps) {
  const { t } = useTranslation()

  if (!activeSection) return null

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <Text as="h2" variant="headingMd">
          {t(SECTION_TITLES[activeSection])}
        </Text>
        <Button icon={XIcon} variant="plain" onClick={onClose} accessibilityLabel={t('close')} />
      </div>
      <div className={styles.sidebarContent}>
        {activeSection === 'fill' && <FillSection {...fillProps} />}
        {activeSection === 'stroke' && <StrokeSection {...strokeProps} />}
        {activeSection === 'filters' && <FiltersSection {...filtersProps} />}
        {activeSection === 'adjustments' && <AdjustmentsSection {...adjustmentsProps} />}
        {activeSection === 'draw' && drawModeProps && <DrawModeSection {...drawModeProps} />}
        {activeSection === 'edit' && editModeProps && <EditModeSection {...editModeProps} />}
        {activeSection === 'guide-image' && guideImageProps && <GuideImageSection {...guideImageProps} />}
      </div>
    </div>
  )
}

// Re-export types
export type { SidebarSection, EditorSidebarProps } from './types'
