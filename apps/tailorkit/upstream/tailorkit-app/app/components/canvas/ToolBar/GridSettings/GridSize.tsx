import { TextField, Text, Box, Popover, Button } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTools } from '~/modules/TemplateEditor/hooks/useTools'
import { DEFAULT_GRID_SIZE } from '../../Grid/constants'
import useCanvasDimension from '~/utils/hooks/useCanvasDimension'
import { useTranslation } from 'react-i18next'
import { CaretDownIcon } from '@shopify/polaris-icons'
import styles from '../styles.module.css'

export const GridSize = () => {
  const [popoverGridToolActive, setPopoverQuickToolActive] = useState(false)
  const onTogglePopoverGridTool = useCallback(() => {
    setPopoverQuickToolActive(prev => !prev)
  }, [])

  const { t } = useTranslation()
  const {
    toolBarSettings: { grid },
    onGridSizeChangeHandler,
  } = useTools()

  const { measurementUnit } = useCanvasDimension()
  const defaultGridSize = useMemo(() => {
    return (grid?.gridSize || DEFAULT_GRID_SIZE).toString()
  }, [grid?.gridSize])

  const [gridSize, setGridSize] = useState(defaultGridSize)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused && defaultGridSize !== gridSize) {
      setGridSize(defaultGridSize)
    }
  }, [defaultGridSize, gridSize, focused])

  return (
    <div className={styles.SelectToolsWrapper}>
      <Popover
        active={popoverGridToolActive}
        activator={<Button icon={CaretDownIcon} variant="plain" onClick={onTogglePopoverGridTool} />}
        onClose={onTogglePopoverGridTool}
      >
        <Popover.Section>
          <div className="tailorkit-input_field">
            <Box width="100px">
              <TextField
                size="slim"
                autoComplete="off"
                label={
                  <Text variant="bodyXs" as="span">
                    {t('grid-size')}
                  </Text>
                }
                type="number"
                value={gridSize}
                min={0}
                suffix={measurementUnit}
                onChange={(gridSize: string) => {
                  setGridSize(gridSize)
                  setTimeout(() => {
                    onGridSizeChangeHandler(gridSize)
                  }, 200)
                }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
            </Box>
          </div>
        </Popover.Section>
      </Popover>
    </div>
  )
}
