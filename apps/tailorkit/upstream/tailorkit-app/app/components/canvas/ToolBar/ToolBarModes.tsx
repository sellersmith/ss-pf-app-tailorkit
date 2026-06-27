import { BlockStack, Box, Button, InlineStack, Popover, Text } from '@shopify/polaris'
import { CaretDownIcon, CheckIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { ToolBarMode } from '~/modules/TemplateEditor/contexts/ToolBarContext'
import { TOOL_BAR_MODES } from '~/modules/TemplateEditor/contexts/ToolBarContext'
import styles from './styles.module.css'

interface ToolBarModesProps {
  mode: ToolBarMode
  popoverToolActive: boolean
  onTogglePopoverTool: () => void
  onModeChangeHandler: (mode: ToolBarMode) => void
}

function ToolBarModes(props: ToolBarModesProps) {
  const { popoverToolActive, onTogglePopoverTool, onModeChangeHandler } = props
  const { t } = useTranslation()

  return (
    <div className={styles.SelectToolsWrapper}>
      <Popover
        active={popoverToolActive}
        activator={<Button icon={CaretDownIcon} variant="plain" onClick={onTogglePopoverTool} />}
        onClose={onTogglePopoverTool}
      >
        <Popover.Section>
          <BlockStack>
            {TOOL_BAR_MODES.map(mode => (
              <div
                key={mode.label}
                className={styles.SelectToolItem}
                onClick={() => onModeChangeHandler(mode.id)}
                role="button"
              >
                <Box paddingBlock="100">
                  <InlineStack gap={'100'} wrap={false} align="center" blockAlign="center">
                    <div style={{ visibility: props.mode === mode.id ? 'visible' : 'hidden' }}>
                      <div className={styles.ToolItem}>
                        <Button icon={CheckIcon} variant="plain" />
                      </div>
                    </div>
                    <div className={styles.ToolItem}>
                      <Button icon={mode.icon} variant="plain" onClick={() => onModeChangeHandler(mode.id)} />
                    </div>
                    <Box paddingInlineEnd={'100'}>
                      <div style={{ userSelect: 'none' }}>
                        <Text as="p" variant="bodyMd">
                          {t(mode.label)}
                        </Text>
                      </div>
                    </Box>
                  </InlineStack>
                </Box>
              </div>
            ))}
          </BlockStack>
        </Popover.Section>
      </Popover>
    </div>
  )
}

export default ToolBarModes
