import { Box, Button, Popover } from '@shopify/polaris'
import { MenuVerticalIcon } from '@shopify/polaris-icons'
import { memo } from 'react'

/**
 * EditingToolsMobile - Mobile popover wrapping the list
 */
export const EditingToolsMobile = memo(function EditingToolsMobile(props: {
  menuPopoverActive: boolean
  toggleMenuPopover: () => void
  renderMenu: () => JSX.Element
}) {
  const { menuPopoverActive, toggleMenuPopover, renderMenu } = props
  return (
    <Popover
      active={menuPopoverActive}
      activator={<Button variant="monochromePlain" icon={MenuVerticalIcon} onClick={toggleMenuPopover} />}
      onClose={toggleMenuPopover}
      preventCloseOnChildOverlayClick
    >
      <Box padding={'0'}>{renderMenu()}</Box>
    </Popover>
  )
})
