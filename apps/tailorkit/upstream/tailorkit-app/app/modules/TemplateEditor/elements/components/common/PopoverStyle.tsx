import React, { useCallback, useMemo, useState } from 'react'
import StyleSettingPopover from '~/components/common/StyleSettingPopover'
import { Popover, Tooltip } from '@shopify/polaris'

function PopoverStyle(props: { activator: React.ReactNode; tooltip?: string; children: React.ReactNode }) {
  const [popoverActive, setPopoverActive] = useState(false)

  const togglePopover = useCallback(() => {
    setPopoverActive(!popoverActive)
  }, [popoverActive])

  const activatorWithClick = useMemo(() => {
    return (
      <div onClick={togglePopover}>
        {props.tooltip ? (
          <Tooltip content={props.tooltip} active={popoverActive ? false : undefined}>
            {props.activator}
          </Tooltip>
        ) : (
          props.activator
        )}
      </div>
    )
  }, [popoverActive, props.activator, props.tooltip, togglePopover])

  return (
    <StyleSettingPopover
      zIndexOverride={9}
      activator={activatorWithClick}
      active={popoverActive}
      onClose={togglePopover}
    >
      <Popover.Pane sectioned maxHeight="500px">
        {props.children}
      </Popover.Pane>
    </StyleSettingPopover>
  )
}

export default PopoverStyle
