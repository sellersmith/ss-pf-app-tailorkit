import type { IconProps } from '@shopify/polaris'
import { Box, Button, Icon, InlineStack, Tooltip } from '@shopify/polaris'
import { useMemo } from 'react'
import { Fragment } from 'react/jsx-runtime'
import type { ToolBarQuickTool } from '~/modules/TemplateEditor/contexts/ToolBarContext'
import { TOOL_BAR_QUICK_TOOLS } from '~/modules/TemplateEditor/contexts/ToolBarContext'
import { GridSize } from './GridSettings/GridSize'
import styles from './styles.module.css'
import { useTranslation } from 'react-i18next'

interface ToolBarQuickToolsProps {
  quickTools: ToolBarQuickTool[]
  onQuickToolsChangeHandler: (toolId: ToolBarQuickTool) => void
}

function ToolBarQuickTools(props: ToolBarQuickToolsProps) {
  const { quickTools, onQuickToolsChangeHandler } = props
  const { t } = useTranslation()

  const isSelectingGridTool = useMemo(() => quickTools.find(quickTool => quickTool === 'grid-tool'), [quickTools])

  return (
    <Fragment>
      {TOOL_BAR_QUICK_TOOLS.map(tool => {
        if (!tool.tooltip && tool.label && tool.shortcut) {
          tool.tooltip = `${t(tool.label)} (${tool.shortcut})`
        }

        const buttonElement = (
          <Button
            icon={
              tool.iconPolaris ? (
                <Icon source={tool.icon as IconProps['source']} tone={tool.tone as IconProps['tone']} />
              ) : (
                tool.icon
              )
            }
            variant={quickTools.includes(tool.id) ? 'secondary' : 'plain'}
          />
        )

        return (
          <InlineStack key={tool.id} align="center" blockAlign="center" wrap={false}>
            <div className={styles.SelectToolItem} role="button" onClick={() => onQuickToolsChangeHandler(tool.id)}>
              <Box paddingBlock="100">
                <InlineStack gap={'100'} wrap={false} blockAlign="center">
                  <div className={styles.ToolItem}>
                    <div className={tool.tone ? '' : styles.ToolItemNoneFill} style={{ display: 'inline-flex' }}>
                      {tool.tooltip ? <Tooltip content={t(tool.tooltip)}>{buttonElement}</Tooltip> : buttonElement}
                    </div>
                  </div>
                </InlineStack>
              </Box>
            </div>
            {tool.id === 'grid-tool' && isSelectingGridTool && <GridSize />}
          </InlineStack>
        )
      })}
    </Fragment>
  )
}

export default ToolBarQuickTools
