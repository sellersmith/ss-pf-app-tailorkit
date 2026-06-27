import { Box, Button, InlineStack, Modal, Tooltip } from '@shopify/polaris'
import { KeyboardIcon } from '@shopify/polaris-icons'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyboardShortcutsTable } from '~/components/ui/KeyboardShortcutsTable'
import type { ToolBarMode, ToolBarQuickTool } from '~/modules/TemplateEditor/contexts/ToolBarContext'
import { TOOL_BAR_MODES } from '~/modules/TemplateEditor/contexts/ToolBarContext'
import { createCanvasKeyboardShortcuts } from '~/utils/keyboardShortcuts'
import styles from './styles.module.css'
import ToolBarModes from './ToolBarModes'
import ToolBarQuickTools from './ToolBarQuickTools'
import { useLocation } from '@remix-run/react'
import { usePreventPageScroll } from '~/modules/modals/hooks/usePreventPageScroll'

interface IToolBarProps {
  mode: ToolBarMode
  quickTools: ToolBarQuickTool[]
  onModeChange: (mode: ToolBarMode) => void
  onQuickToolsChange: (quickTool: ToolBarQuickTool) => void
  extraTools?: React.ReactNode
  secondaryTools?: React.ReactNode
}

export default function ToolBar(props: IToolBarProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const isIntegrationEditor = location.pathname.includes('/integrations')

  const { mode, quickTools, onModeChange, onQuickToolsChange, extraTools, secondaryTools } = props

  const [popoverToolActive, setPopoverToolActive] = useState(false)

  const onTogglePopoverTool = useCallback(() => {
    setPopoverToolActive(prev => !prev)
  }, [])

  const onModeChangeHandler = useCallback(
    (tool: ToolBarMode) => {
      // Change the mode
      onModeChange(tool)

      // Close the popover
      setPopoverToolActive(false)
    },
    [onModeChange]
  )

  const onQuickToolsChangeHandler = useCallback(
    (quickTool: ToolBarQuickTool) => {
      onQuickToolsChange(quickTool)
    },
    [onQuickToolsChange]
  )

  const toolIcon = useMemo(() => {
    return TOOL_BAR_MODES.find(tool => tool.id === mode)?.icon
  }, [mode])

  return (
    <>
      <div className={styles.ToolBelt}>
        <Box borderRadius="200" background="bg-surface" padding="100" shadow="border-inset">
          <InlineStack align="center" blockAlign="center" gap={'100'} wrap={false}>
            <Tooltip content={t('pointer-mode')} active={popoverToolActive ? false : undefined}>
              <InlineStack wrap={false}>
                <div className={styles.ToolItem}>
                  <Button icon={toolIcon} />
                </div>
                <ToolBarModes
                  mode={mode}
                  popoverToolActive={popoverToolActive}
                  onTogglePopoverTool={onTogglePopoverTool}
                  onModeChangeHandler={onModeChangeHandler}
                />
              </InlineStack>
            </Tooltip>

            {extraTools}

            {/* Role divider: separates primary actions from secondary tools */}
            <Box paddingInlineStart="150" paddingInlineEnd="150">
              <Box borderInlineStartWidth="025" borderColor="border" minHeight="28px" />
            </Box>

            <ToolBarQuickTools quickTools={quickTools} onQuickToolsChangeHandler={onQuickToolsChangeHandler} />

            {secondaryTools}

            {!isIntegrationEditor && <KeyboardShortcutsModal />}
          </InlineStack>
        </Box>
      </div>
    </>
  )
}

function KeyboardShortcutsModal() {
  const { t } = useTranslation()
  const [active, setActive] = useState(false)

  const onOpen = useCallback(() => setActive(true), [])
  const onClose = useCallback(() => setActive(false), [])

  const shortcutsData = createCanvasKeyboardShortcuts(t)

  // Prevent page scroll when modal is open
  usePreventPageScroll(active)

  return (
    <>
      <Tooltip content={t('keyboard-shortcuts')}>
        <Box padding="100">
          <InlineStack wrap={false} blockAlign="center">
            <Button icon={KeyboardIcon} variant="plain" onClick={onOpen} />
          </InlineStack>
        </Box>
      </Tooltip>

      <Modal
        open={active}
        onClose={onClose}
        title={t('keyboard-shortcuts')}
        secondaryActions={[{ content: t('close'), onAction: onClose }]}
      >
        <Modal.Section>
          <KeyboardShortcutsTable t={t} data={shortcutsData} showPlatformLabels={false} />
        </Modal.Section>
      </Modal>
    </>
  )
}
