import { ActionList, Button, Popover } from '@shopify/polaris'
import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useState } from 'react'

interface ICreateTemplatePopoverProps {
  t: any
  setActiveModalCreateTemplate: Dispatch<SetStateAction<boolean>>
  setActiveModalUploadPSDFile: Dispatch<SetStateAction<boolean>>
}

export function CreateTemplatePopover(props: ICreateTemplatePopoverProps) {
  const { t, setActiveModalCreateTemplate, setActiveModalUploadPSDFile } = props
  const [popoverActive, setPopoverActive] = useState(false)

  const togglePopoverActive = useCallback(() => setPopoverActive(popoverActive => !popoverActive), [])

  const activator = (
    <Button onClick={togglePopoverActive} disclosure variant="primary">
      {t('create-template')}
    </Button>
  )

  return (
    <Popover active={popoverActive} activator={activator} autofocusTarget="first-node" onClose={togglePopoverActive}>
      <ActionList
        actionRole="menuitem"
        items={[
          {
            content: t('create-new-template'),
            onAction: () => {
              setActiveModalCreateTemplate(true)
            },
          },
          {
            content: t('upload-your-design'),
            onAction: () => {
              setActiveModalUploadPSDFile(true)
            },
          },
        ]}
      />
    </Popover>
  )
}
