import type { ButtonProps, IconSource } from '@shopify/polaris'
import { Box, Button, InlineStack, Tooltip } from '@shopify/polaris'
import { useCallback, type JSXElementConstructor, type ReactElement } from 'react'
import styles from './styles.module.css'
import { FlexCenter } from '~/components/common/Flex'

export type OptionButtonToggle = {
  id?: string
  value: any
  tooltip?: string
  accessibilityLabel?: string
  label: ReactElement<any, string | JSXElementConstructor<any>> | IconSource
  disabled?: boolean
}

interface IMultipleButtonToggleProps {
  multiple?: boolean
  disableToggle?: boolean
  selected: any[]
  options: OptionButtonToggle[]
  onClick: (value: any[]) => void
  allowScroll?: boolean
}

export const MultipleButtonToggle = ({ options, allowScroll = false, ...otherProps }: IMultipleButtonToggleProps) => {
  const content = (
    <InlineStack wrap={false} blockAlign="center">
      {options.map(opt => (
        <ButtonToggle key={opt.value} option={opt} disabled={opt.disabled} {...opt} {...otherProps} />
      ))}
    </InlineStack>
  )

  return (
    <Box borderRadius="200" background="bg-fill-secondary" padding={'050'} width="100%">
      {allowScroll ? <div className={styles.ScrollContainer}>{content}</div> : content}
    </Box>
  )
}

const ButtonToggle = ({
  multiple,
  disableToggle,
  option,
  selected,
  onClick,
  ...otherProps
}: Omit<IMultipleButtonToggleProps, 'options'> & { option: OptionButtonToggle; disabled?: boolean }) => {
  const onHandleClick = useCallback(() => {
    if (disableToggle && selected.includes(option.value)) {
      return
    }

    let updatedValue

    if (multiple) {
      updatedValue = selected.includes(option.value)
        ? selected.filter(s => s !== option.value)
        : [...selected, option.value]
    } else {
      updatedValue = selected.includes(option.value) ? [] : [option.value]
    }

    onClick(updatedValue)
  }, [disableToggle, multiple, onClick, option.value, selected])

  return (
    <StyledInspectorBtn
      icon={option.label}
      accessibilityLabel={option.accessibilityLabel}
      onClick={onHandleClick}
      variant={selected.includes(option.value) ? 'secondary' : 'tertiary'}
      {...otherProps}
    />
  )
}

const StyledInspectorBtn = (props: ButtonProps & { tooltip?: string }) => {
  const { disabled, variant, tooltip, ...restProps } = props

  const content = (
    <div className={`${styles.ButtonToggle} ${disabled ? styles.ButtonToggleDisabled : ''}`}>
      <Button fullWidth disabled={disabled && !!variant} variant={variant} {...restProps} />
    </div>
  )

  if (tooltip) {
    return (
      <div className={`${styles.ButtonToggle} ${disabled ? styles.ButtonToggleDisabled : ''}`}>
        <Tooltip content={tooltip}>
          <FlexCenter>
            <Button fullWidth disabled={disabled && !!variant} variant={variant} {...restProps} />
          </FlexCenter>
        </Tooltip>
      </div>
    )
  }

  return content
}
