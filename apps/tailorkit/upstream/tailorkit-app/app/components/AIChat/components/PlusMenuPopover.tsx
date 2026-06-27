/**
 * + button popover for AI Chat input bar.
 * Shows Files / Skills / Mention sections (like Shopify Sidekick's + menu).
 * Skills and Mention sections navigate to their respective pickers.
 */

import { useCallback, useState } from 'react'
import { ActionList, Button, Icon, Popover } from '@shopify/polaris'
import { PlusIcon, FileIcon, MagicIcon, MentionIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'

interface PlusMenuPopoverProps {
  /** Called when Skills section is clicked — opens SkillsList */
  onSkillsClick: () => void
  /** Called when Mention section is clicked — opens MentionPicker */
  onMentionClick: () => void
  /** Called when Files section is clicked — opens file picker modal */
  onFilesClick?: () => void
  /** Whether to disable the button */
  disabled?: boolean
}

export default function PlusMenuPopover({
  onSkillsClick,
  onMentionClick,
  onFilesClick,
  disabled = false,
}: PlusMenuPopoverProps) {
  const [active, setActive] = useState(false)
  const { t } = useTranslation()

  const toggleActive = useCallback(() => setActive(prev => !prev), [])
  const handleClose = useCallback(() => setActive(false), [])

  const handleSkills = useCallback(() => {
    handleClose()
    onSkillsClick()
  }, [handleClose, onSkillsClick])

  const handleMention = useCallback(() => {
    handleClose()
    onMentionClick()
  }, [handleClose, onMentionClick])

  const handleFiles = useCallback(() => {
    handleClose()
    onFilesClick?.()
  }, [handleClose, onFilesClick])

  const activator = (
    <Button
      icon={<Icon source={PlusIcon} />}
      onClick={toggleActive}
      disabled={disabled}
      variant="tertiary"
      accessibilityLabel={t('more-options')}
    />
  )

  return (
    <Popover
      active={active}
      activator={activator}
      onClose={handleClose}
      preferredAlignment="left"
      preferredPosition="above"
      activatorWrapper="div"
      zIndexOverride={1000}
    >
      <Popover.Pane>
        <ActionList
          items={[
            {
              content: t('files'),
              prefix: <Icon source={FileIcon} />,
              onAction: handleFiles,
              disabled: !onFilesClick,
            },
            {
              content: t('skills'),
              prefix: <Icon source={MagicIcon} />,
              suffix: <span style={{ color: 'var(--p-color-text-secondary)', fontSize: '13px' }}>/</span>,
              onAction: handleSkills,
            },
            {
              content: t('mention'),
              prefix: <Icon source={MentionIcon} />,
              suffix: <span style={{ color: 'var(--p-color-text-secondary)', fontSize: '13px' }}>@</span>,
              onAction: handleMention,
            },
          ]}
        />
      </Popover.Pane>
    </Popover>
  )
}
