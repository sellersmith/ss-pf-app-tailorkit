import { Box, Button, Icon, Popover, Text, TextField, Tooltip, BlockStack } from '@shopify/polaris'
import { AppsIcon } from '@shopify/polaris-icons'
import { useMemo, type Dispatch, type SetStateAction } from 'react'
import type { ToolBarQuickTool } from '../../contexts/ToolBarContext'
import Switch from '~/components/common/Switch'

type GridToolProps = {
  t: (key: string) => string
  isShowingGridTool: boolean
  gridPopoverActive: boolean
  toggleGridPopover: () => void
  measurementUnit: string
  gridSize: string
  setGridSize: Dispatch<SetStateAction<string>>
  setGridInputFocused: Dispatch<SetStateAction<boolean>>
  onGridSizeChangeHandler: (value: string) => void
  onQuickToolsChangeHandler: (quickTool: ToolBarQuickTool) => void
}

export default function GridTool(props: GridToolProps) {
  const {
    t,
    isShowingGridTool,
    gridPopoverActive,
    toggleGridPopover,
    measurementUnit,
    gridSize,
    setGridSize,
    setGridInputFocused,
    onGridSizeChangeHandler,
    onQuickToolsChangeHandler,
  } = props

  const activator = useMemo(
    () => (
      <Tooltip content={`${t('display-grid')} (Shift + G)`}>
        <Box paddingInlineStart={'150'}>
          <div className="tailorkit-action-list custom-action-link-component">
            <Button
              variant="monochromePlain"
              icon={<Icon source={AppsIcon} tone="base" />}
              pressed={isShowingGridTool}
              onClick={toggleGridPopover}
            >
              {t('display-grid')}
            </Button>
          </div>
        </Box>
      </Tooltip>
    ),
    [t, isShowingGridTool, toggleGridPopover]
  )

  return (
    <Popover active={gridPopoverActive} activator={activator} onClose={toggleGridPopover}>
      <Popover.Section>
        <Box minWidth="120px" minHeight={isShowingGridTool ? '104px' : '30px'}>
          <BlockStack gap="200">
            {/* Grid toggle switch */}
            <Switch
              checked={isShowingGridTool}
              label={t('display-grid')}
              onInput={() => onQuickToolsChangeHandler('grid-tool')}
            />

            {/* Grid size input - only show when grid is enabled */}
            {isShowingGridTool && (
              <div className="tailorkit-input_field">
                <TextField
                  size="slim"
                  autoComplete="off"
                  label={
                    <Text variant="bodyXs" as="span">
                      {t('size')}
                    </Text>
                  }
                  type="number"
                  value={gridSize}
                  min={0}
                  suffix={measurementUnit}
                  onChange={(value: string) => {
                    setGridSize(value)
                    setTimeout(() => {
                      onGridSizeChangeHandler(value)
                    }, 200)
                  }}
                  onFocus={() => setGridInputFocused(true)}
                  onBlur={() => setGridInputFocused(false)}
                />
              </div>
            )}
          </BlockStack>
        </Box>
      </Popover.Section>
    </Popover>
  )
}
