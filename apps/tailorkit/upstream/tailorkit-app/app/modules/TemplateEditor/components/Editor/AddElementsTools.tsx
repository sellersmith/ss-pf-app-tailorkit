/**
 * Optimized Add Elements Tools Component
 *
 * This component provides tools for adding different types of elements to the template editor.
 * It supports both mobile and desktop layouts with different UI patterns.
 */

import { Box } from '@shopify/polaris'
import { useCallback, useState } from 'react'
import useDevices from '~/utils/hooks/useDevice'
import { useElementActions } from './hooks/useElementActions'
import { useElementModals } from './hooks/useElementModals'
import { MobileAddElementsMenu } from './components/MobileAddElementsMenu'
import { DesktopAddElementsMenu } from './components/DesktopAddElementsMenu'
import ClipartsSelectorComponent from '../Outline/Header/ClipartsSelectorComponent'
import DropZoneWithCustomPSDFileDialogComponent from '../Outline/Header/DropZonePSDFileComponent'
import ImageSelectorComponent from '../Outline/Header/ImageSelectorComponent'
import type { EElementType } from '../Outline/Header/ButtonAddElements'

const ENABLE_ADD_ELEMENTS_TOOLS = false

/**
 * Optimized Add Elements Tools Component
 */
export default function AddElementsTools(props: { excludeTypes?: EElementType[] }) {
  const { excludeTypes = [] } = props
  const { isSmallMobileView } = useDevices()

  // Custom hooks for modular functionality
  const { addElements } = useElementActions()
  const { toggleOpenImagesDialog, toggleOpenClipartsDialog, toggleOpenPSDDialog } = useElementModals()

  // AI Image now opens as a sub-inspector panel; popover removed

  // Simple state for legacy components that need popover state
  const [, setPopoverActive] = useState(false)
  const togglePopoverActive = useCallback((state?: boolean) => {
    setPopoverActive(prev => state ?? !prev)
  }, [])

  if (!ENABLE_ADD_ELEMENTS_TOOLS) return null

  return (
    <Box>
      {/* Render appropriate menu based on device type */}
      {isSmallMobileView ? (
        <MobileAddElementsMenu
          addElements={addElements}
          toggleOpenImagesDialog={toggleOpenImagesDialog}
          toggleOpenClipartsDialog={toggleOpenClipartsDialog}
          toggleOpenPSDDialog={toggleOpenPSDDialog}
        />
      ) : (
        <DesktopAddElementsMenu
          addElements={addElements}
          toggleOpenImagesDialog={toggleOpenImagesDialog}
          toggleOpenClipartsDialog={toggleOpenClipartsDialog}
          excludeTypes={excludeTypes}
        />
      )}

      {/* Support components for dialogs/popovers */}
      <DropZoneWithCustomPSDFileDialogComponent />
      <ImageSelectorComponent addElements={addElements} />
      <ClipartsSelectorComponent togglePopoverActive={togglePopoverActive} addElements={addElements} />
    </Box>
  )
}
