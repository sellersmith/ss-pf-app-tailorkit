import { BlockStack, Checkbox, Text } from '@shopify/polaris'
import useDevices from '~/utils/hooks/useDevice'

/**
 * Platform-aware switch control.
 * - On iOS devices, renders a Polaris Checkbox for consistent accessibility and native feel
 * - On other platforms, renders the `s-switch` web component (wrapped to ensure state sync)
 */
export default function Switch(props: SwitchProps) {
  const { onInput, onChange, checked, id, label, helpText, disabled, ...rest } = props
  const { isIOS } = useDevices()

  if (isIOS) {
    const handleCheckboxChange = (newChecked: boolean, checkboxId: string) => {
      // Preserve both event styles for downstream callers
      if (typeof onInput === 'function') {
        requestAnimationFrame(() => {
          onInput()
        })
      }
      if (typeof onChange === 'function') {
        requestAnimationFrame(() => {
          onChange(newChecked, checkboxId)
        })
      }
    }

    return (
      <Checkbox
        label={label}
        checked={!!checked}
        helpText={helpText}
        disabled={disabled}
        onChange={handleCheckboxChange}
      />
    )
  }

  /**
   * Click handler for the web component switch.
   * Some browsers may not reflect `checked` immediately, so we trigger via wrapper.
   * We use requestAnimationFrame to ensure the event is triggered after the DOM is updated.
   */
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return

    e.preventDefault()
    e.stopPropagation()

    if (typeof onInput === 'function') {
      requestAnimationFrame(() => {
        onInput()
      })
    }
    if (typeof onChange === 'function') {
      requestAnimationFrame(() => {
        onChange(!checked, id || '')
      })
    }
  }

  return (
    <div role="switch" aria-checked={checked} onClick={onClick} style={{ display: 'inline-block' }}>
      {/* Pass through all props to the web component */}
      <BlockStack>
        {/*
         * PageFly React-18 compat: upstream runs React 19, which passes a boolean prop to a custom element
         * as a PROPERTY (`s-switch.checked = false` → off). The app-platform admin bundle runs React 18.2,
         * which serializes an unknown boolean prop on a custom element as a STRING ATTRIBUTE
         * (`checked="false"` / `disabled="false"`). Polaris `s-switch` reads attribute PRESENCE, so a falsy
         * boolean rendered as `"false"` is read as TRUE → the switch always shows on / disabled. Collapse
         * BOTH falsy `checked` and `disabled` to `undefined` so React 18 omits the attribute entirely. This
         * matches PageFly's own working `<s-switch checked={enabled || undefined} />` usage
         * (web/core/src/features/page-performance/components/SectionEngagement.tsx). React does NOT
         * special-case `checked` for custom elements (only for native `<input>`), so it needs the same guard.
         */}
        <s-switch {...{ label, checked: checked || undefined, disabled: disabled || undefined, onInput, onChange, id, ...rest }} />
        {helpText && typeof helpText === 'string' ? (
          <Text as="span" variant="bodySm" tone="subdued">
            {helpText}
          </Text>
        ) : (
          helpText
        )}
      </BlockStack>
    </div>
  )
}
