import type { TFunction } from 'i18next'
import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_GRID_SIZE } from '~/components/canvas/Grid/constants'
import GridTool from '~/modules/TemplateEditor/components/Header/GridTool'
import type { ToolBarQuickTool } from '~/modules/TemplateEditor/contexts/ToolBarContext'
import { useTools } from '~/modules/TemplateEditor/hooks/useTools'
import useCanvasDimension from '~/utils/hooks/useCanvasDimension'

interface GridToolWrapperProps {
  t: TFunction
  isShowingGridTool: boolean
  onQuickToolsChangeHandler: (tool: ToolBarQuickTool) => void
}

/**
 * GridToolWrapper - Encapsulates all grid tool state and logic
 * Avoids prop drilling by managing state internally
 */
export function GridToolWrapper({ t, isShowingGridTool, onQuickToolsChangeHandler }: GridToolWrapperProps) {
  // Grid tool dependencies
  const { measurementUnit } = useCanvasDimension()
  const { toolBarSettings, onGridSizeChangeHandler } = useTools()

  const [gridPopoverActive, setGridPopoverActive] = useState(false)
  const toggleGridPopover = useCallback(() => setGridPopoverActive(prev => !prev), [])

  // Grid size input state
  const defaultGridSize = (toolBarSettings.grid?.gridSize || DEFAULT_GRID_SIZE).toString()
  const [gridSize, setGridSize] = useState(defaultGridSize)
  const [gridInputFocused, setGridInputFocused] = useState(false)

  // Update grid size when settings change
  useEffect(() => {
    if (!gridInputFocused) {
      setGridSize(defaultGridSize)
    }
  }, [defaultGridSize, gridInputFocused])

  return (
    <GridTool
      t={t}
      isShowingGridTool={isShowingGridTool}
      gridPopoverActive={gridPopoverActive}
      toggleGridPopover={toggleGridPopover}
      measurementUnit={measurementUnit}
      gridSize={gridSize}
      setGridSize={setGridSize}
      setGridInputFocused={setGridInputFocused}
      onGridSizeChangeHandler={onGridSizeChangeHandler}
      onQuickToolsChangeHandler={onQuickToolsChangeHandler}
    />
  )
}
