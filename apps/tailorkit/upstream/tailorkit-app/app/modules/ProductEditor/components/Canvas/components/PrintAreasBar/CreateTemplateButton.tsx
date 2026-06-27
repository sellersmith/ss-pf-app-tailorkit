import { PlusIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useState } from 'react'
import { ActionList, Popover, Button, Box, Tooltip } from '@shopify/polaris'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'

export default function CreateTemplateButton() {
  const { t } = useTranslation()
  const { state, openModal, closeModal } = useModal()
  const openFileDialog = state?.[MODAL_ID.PSD_FILE_SELECTOR_MODAL_FOR_NEW_TEMPLATE]?.active

  const [popoverActive, setPopoverActive] = useState(false)

  const togglePopoverActive = useCallback(() => setPopoverActive(popoverActive => !popoverActive), [])

  const toggleOpenFileDialog = useCallback(() => {
    if (openFileDialog) {
      closeModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL_FOR_NEW_TEMPLATE)
    } else {
      openModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL_FOR_NEW_TEMPLATE)
    }
  }, [closeModal, openModal, openFileDialog])

  const activator = useMemo(
    () => (
      <Tooltip
        content={t('create-a-new-template-that-will-be-applied-as-a-design-layer-on-your-product')}
        preferredPosition="above"
        {...(popoverActive ? { active: false } : {})}
      >
        <Button icon={PlusIcon} onClick={togglePopoverActive} disclosure>
          {t('add-template')}
        </Button>
      </Tooltip>
    ),
    [t, togglePopoverActive, popoverActive]
  )

  return (
    <Box>
      <Popover activator={activator} active={popoverActive} onClose={togglePopoverActive}>
        <ActionList
          items={[
            {
              content: t('create-new-template'),
              onAction: () => openModal(MODAL_ID.CREATE_NEW_TEMPLATE_MODAL),
            },
            {
              content: t('select-existing-template'),
              onAction: () => openModal(MODAL_ID.SELECT_EXISTING_TEMPLATE_MODAL),
            },
            {
              content: t('upload-psd-file'),
              onAction: toggleOpenFileDialog,
            },
          ]}
        />
      </Popover>
    </Box>
  )
}
