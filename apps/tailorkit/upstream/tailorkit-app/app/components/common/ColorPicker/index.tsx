/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable max-lines */
import EyeDropperButton from './EyeDropperButton'
import InputColorPicker from './InputPrefix'
import PresetColors from './PresetColors'
import type { HSBAColor, HSBColor, RGBAColor } from '@shopify/polaris'
import {
  BlockStack,
  Box,
  Button,
  ColorPicker,
  Divider,
  InlineGrid,
  InlineStack,
  Popover,
  RangeSlider,
  Text,
  TextField,
  hsbToRgb,
  rgbToHsb,
  rgbaString,
} from '@shopify/polaris'
import { XCircleIcon } from '@shopify/polaris-icons'
import { type PopoverOverlayProps } from '@shopify/polaris/build/ts/src/components/Popover/components'
import React, { type ReactNode, useCallback, useEffect, useMemo, useState, startTransition } from 'react'
import { useTranslation } from 'react-i18next'
import tinycolor from 'tinycolor2'
import { useColors } from '~/utils/hooks/useColors'
import { useDebouncedCallback } from '~/utils/hooks/useDebouncedCallback'

export interface ColorPickerInterface {
  id?: string
  preferredAlignment?: PopoverOverlayProps['preferredAlignment']
  preferredPosition?: PopoverOverlayProps['preferredPosition']
  value?: string
  placeholder?: string
  activator?: ReactNode
  hasFooterSave?: boolean
  defaultVisible?: boolean
  showInPopover?: boolean
  width?: string
  /** Debounce milliseconds for live onChange events (drag/typing). 0/undefined disables. */
  debounceMs?: number
  onChange?: (color: string, notPushHistory?: boolean) => void
  onClosePopup?: () => void
  onClear?: () => void
}

export function convertTinycolorToPolarisColor(color: tinycolor.ColorFormats.RGBA): RGBAColor {
  const { r, g, b, a } = color
  return { red: r, green: g, blue: b, alpha: a }
}

// TODO: make this one reusable
const EditorColorPicker: React.FC<ColorPickerInterface> = ({
  value,
  placeholder,
  onChange,
  onClear,
  activator = null,
  hasFooterSave = false,
  defaultVisible = null,
  showInPopover = true,
  onClosePopup,
  id,
  preferredAlignment = 'center',
  preferredPosition = 'below',
  width = '300px',
  debounceMs,
}) => {
  const { t } = useTranslation()
  const [focusInput, setFocusInput] = useState(false)
  const [visible, setVisible] = useState(false)
  const [shouldFocusInputField, setShouldFocusInputField] = useState(false)
  const [colorInputValue, setColorInputValue] = useState(value)
  const color = tinycolor(value)
  const { rgbColor, hexColor, hsbColor } = useColors(color)

  const [focus, setFocus] = useState('')
  const [displayValues, setDisplayValues] = useState({
    r: rgbColor.r,
    g: rgbColor.g,
    b: rgbColor.b,
    a: Math.round(rgbColor.a * 100).toFixed(0),
    hex: hexColor,
  })
  const [colorLocalState, setColorLocalState] = useState(hsbColor)

  // Stable debounced emitter for live updates
  const debouncedOnChange = useDebouncedCallback((nextColor: string) => {
    if (typeof onChange === 'function') {
      onChange(nextColor)
    }
  }, debounceMs)

  const emitLiveChange = useCallback(
    (nextColor: string) => {
      if (debounceMs && debounceMs > 0) {
        debouncedOnChange(nextColor)
      } else if (typeof onChange === 'function') {
        onChange(nextColor)
      }
    },
    [debouncedOnChange, debounceMs, onChange]
  )

  // Setup a flag which used to automatically focus on the input field when the popover becomes visible
  useEffect(() => {
    // Set a state variable to determine whether the input field should be focused
    setShouldFocusInputField(visible)
  }, [visible])

  // Focus the input field when the popover is visible and the input field is not focused
  useEffect(() => {
    if (visible && !focusInput && shouldFocusInputField) {
      // Reset the shouldFocusInputField state to prevent repetitive focusing
      setShouldFocusInputField(false)

      // Set the focus on the input field
      setFocusInput(true)
    }
  }, [visible, focusInput, shouldFocusInputField])

  const onChangeColorHasFooterSave = useCallback(
    (color: HSBColor, push: boolean) => {
      const rgb = hsbToRgb(color)
      const rgbaStr = rgbaString(rgb)
      const c = tinycolor(rgbaStr)
      const tinyRgb = c.toRgb()
      const hex = c.toHex8String()
      const { r, g, b, a } = tinyRgb

      setDisplayValues({ ...displayValues, r, g, b, a: Math.round(a * 100).toFixed(0), hex })

      if (push && typeof onChange === 'function') {
        onChange(c.toRgbString())
      }
    },
    [onChange]
  )

  const onChangeColor = useCallback(
    (color: HSBAColor) => {
      const rgb = hsbToRgb(color)
      const rgbaStr = rgbaString(rgb)
      const c = tinycolor(rgbaStr)
      const tinyRgb = c.toRgb()
      const hex = c.toHex8String()

      emitLiveChange(c.toRgbString())
      setColorInputValue(c.toRgbString())
      const { r, g, b, a } = tinyRgb
      setDisplayValues({ ...displayValues, r, g, b, a: Math.round(a * 100).toFixed(0), hex })
    },
    [emitLiveChange]
  )

  const handleChangeLocalState = useCallback(
    (value: HSBAColor) => {
      setColorLocalState(value)
      if (hasFooterSave) {
        onChangeColorHasFooterSave(value, false)
      } else {
        onChangeColor(value)
      }
    },
    [hasFooterSave, onChangeColorHasFooterSave, onChangeColor]
  )

  const onSelectPresetColor = useCallback(
    (hexColor: string) => {
      const color = tinycolor(hexColor)
      const rgbString = color.toRgbString()
      const hsbColor = rgbToHsb(convertTinycolorToPolarisColor(color.toRgb()))
      const { r, g, b, a: alpha } = color.toRgb()

      if (!hasFooterSave) {
        emitLiveChange(rgbString)
      }

      setColorLocalState(hsbColor)
      setColorInputValue(rgbString)
      setDisplayValues({ r, g, b, a: Math.round(alpha * 100).toFixed(0), hex: color.toHex8String() })
    },
    [emitLiveChange]
  )

  const onChangeInput = useCallback((name: string, value: string) => {
    setDisplayValues(prev => ({ ...prev, [name]: value }))
  }, [])

  useEffect(() => {
    setColorInputValue(value)
    setColorLocalState(hsbColor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    let color = tinycolor('')
    if (focus === 'hex') {
      const { hex } = displayValues
      color = tinycolor(hex)
    } else if (focus) {
      const { r, g, b, a } = displayValues
      color = tinycolor({ r, g, b, a: parseFloat(a) / 100 })
    }
    const rgbString = color.toRgbString()

    if (color.isValid() && focus && hasFooterSave) {
      const hsbColor = rgbToHsb(convertTinycolorToPolarisColor(color.toRgb()))
      setColorLocalState(hsbColor)
      return
    }

    if (color.isValid() && focus && value !== rgbString && !hasFooterSave) {
      setColorInputValue(rgbString)
      setColorLocalState(rgbToHsb(convertTinycolorToPolarisColor(color.toRgb())))
      emitLiveChange(rgbString)
    }
  }, [displayValues])

  const onBlur = useCallback(() => {
    const rgbString = color.toRgbString()
    setFocusInput(false)
    setFocus('')
    const { r, g, b, a: alpha } = rgbColor

    if (hasFooterSave) {
      let color = tinycolor('')
      if (focus === 'hex') {
        const { hex } = displayValues
        color = tinycolor(hex)
      } else if (focus) {
        const { r, g, b, a } = displayValues
        color = tinycolor({ r, g, b, a: parseFloat(a) / 100 })
      }
      const objectColor = color.toRgb()
      const { r, g, b, a } = objectColor
      setDisplayValues({ r, g, b, a: Math.round(a * 100).toFixed(0), hex: displayValues?.hex })
      return
    }

    if (color.isValid() && value !== rgbString && !hasFooterSave) {
      setColorInputValue(rgbString)
      // Commit on blur should be immediate
      if (typeof onChange === 'function') onChange(rgbString)
    }

    setDisplayValues({ r, g, b, a: Math.round(alpha * 100).toFixed(0), hex: hexColor })
  }, [onChange, value])

  const handleClear = useCallback(() => {
    typeof onClear === 'function' && onClear()
    setColorInputValue('')
  }, [onClear])

  const handleFocusInput = useCallback(() => {
    // Input is not focused or the popover is not open, open the popover.
    if (!focusInput || !visible) {
      setVisible(true)
      setFocusInput(true)
      return
    }

    // Input is focused and the popover is open, close the popover.
    if (focusInput && visible) {
      setVisible(false)
    }
  }, [focusInput, visible])

  const handleSaveFooter = useCallback(() => {
    onChangeColorHasFooterSave(colorLocalState, true)

    if (typeof onClosePopup === 'function') {
      setVisible(false)
      onClosePopup?.()
    } else {
      setVisible(false)
    }
  }, [onChangeColorHasFooterSave, onClosePopup])

  /**
   * Handle color picked from EyeDropper
   * Uses startTransition to batch updates and prevent UI freezing
   */
  const handleColorPicked = useCallback(
    (hexColor: string) => {
      const pickedColor = tinycolor(hexColor)
      const rgbString = pickedColor.toRgbString()
      const hsbColor = rgbToHsb(convertTinycolorToPolarisColor(pickedColor.toRgb()))
      const { r, g, b, a: alpha } = pickedColor.toRgb()

      // Batch all state updates in a single transition to prevent freezing
      startTransition(() => {
        setColorLocalState(hsbColor)
        setColorInputValue(rgbString)
        setDisplayValues({ r, g, b, a: Math.round(alpha * 100).toFixed(0), hex: pickedColor.toHex8String() })
      })

      // Emit change after state updates for better performance
      if (!hasFooterSave) {
        // Use requestIdleCallback or setTimeout to defer the onChange call
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => emitLiveChange(rgbString))
        } else {
          setTimeout(() => emitLiveChange(rgbString), 0)
        }
      }
    },
    [hasFooterSave, emitLiveChange]
  )

  const activatorComp = useMemo(
    () => (
      <div onClick={handleFocusInput}>
        {activator ? (
          activator
        ) : (
          <TextField
            id={`${id}--input`}
            focused={focusInput}
            label="Value"
            labelHidden
            autoComplete="off"
            value={colorInputValue}
            onChange={v => {
              setColorInputValue(v)
              if (tinycolor(v).isValid()) {
                emitLiveChange(v)
                const rgbColor = tinycolor(v).toRgb()
                const { r, g, b, a: alpha } = rgbColor
                setDisplayValues({ r, g, b, a: Math.round(alpha * 100).toFixed(0), hex: hexColor })
              }
            }}
            placeholder={placeholder}
            spellCheck={false}
            onBlur={() => {
              onBlur()
            }}
            prefix={
              <div
                onClick={e => {
                  e.stopPropagation()
                  setFocusInput(true)
                  setVisible(!visible)
                }}
              >
                <InputColorPicker value={value ?? placeholder ?? ''} setVisible={setVisible} visible={visible} />
              </div>
            }
            {...(typeof onClear === 'function' && colorInputValue
              ? {
                  suffix: (
                    <div style={{ visibility: 'visible' }}>
                      <InlineStack align={'center'} blockAlign={'center'}>
                        <Button icon={XCircleIcon} textAlign={'center'} onClick={handleClear} variant="plain" />
                      </InlineStack>
                    </div>
                  ),
                }
              : {})}
          />
        )}
      </div>
    ),
    [handleFocusInput, activator, colorInputValue, placeholder, value, emitLiveChange, hexColor, displayValues, onBlur]
  )

  const popoverContent = useMemo(
    () => (
      <Box width={width} padding="100" paddingBlockStart="200" paddingBlockEnd="200" id={`${id}--color-picker-box`}>
        <BlockStack gap="200">
          <ColorPicker
            id={`${id}--color-picker`}
            fullWidth
            color={colorLocalState}
            onChange={handleChangeLocalState}
            allowAlpha
          />

          <EyeDropperButton
            id={`${id}--eyedropper-button`}
            onColorPicked={handleColorPicked}
            accessibilityLabel="Pick color from screen"
            variant="secondary"
            fullWidth
            content="Pick color"
          />
          <InlineGrid gap="150" columns={'100px repeat(3, 1fr)'}>
            <BlockStack>
              <Text variant="bodyMd" as="span">
                Hex
              </Text>
              <TextField
                id={`${id}--color-picker--hex`}
                label="Hex"
                labelHidden
                autoComplete="off"
                inputMode="numeric"
                value={displayValues.hex}
                onChange={value => {
                  onChangeInput('hex', value)
                }}
                onBlur={onBlur}
                onFocus={() => setFocus('hex')}
              />
            </BlockStack>
            {['r', 'g', 'b'].map(label => (
              <BlockStack inlineAlign="center" key={label}>
                <Text variant="bodyMd" as="span">
                  {label.toUpperCase()}
                </Text>
                <TextField
                  id={`${id}--color-picker--${label}`}
                  label={label.toUpperCase()}
                  labelHidden
                  autoComplete="off"
                  min={0}
                  max={255}
                  inputMode="numeric"
                  value={(displayValues as any)?.[label]?.toString()}
                  onChange={value => onChangeInput(label, value)}
                  onFocus={() => setFocus(label)}
                  onBlur={onBlur}
                />
              </BlockStack>
            ))}
          </InlineGrid>
          <BlockStack gap="100">
            <Text variant="bodyMd" as="span">
              {t('opacity')}
            </Text>
            <InlineStack gap="200" blockAlign="center" wrap={false}>
              <Box width="100%">
                <RangeSlider
                  id={`${id}--color-picker--opacity-slider`}
                  label={t('opacity')}
                  labelHidden
                  min={0}
                  max={100}
                  value={parseInt(displayValues.a, 10) || 0}
                  onChange={value => {
                    onChangeInput('a', String(value))
                    setFocus('a')
                  }}
                />
              </Box>
              <Box maxWidth="70px">
                <TextField
                  id={`${id}--color-picker--opacity`}
                  label={t('opacity')}
                  labelHidden
                  autoComplete="off"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={displayValues.a}
                  onChange={value => onChangeInput('a', value)}
                  onFocus={() => setFocus('a')}
                  onBlur={onBlur}
                  suffix="%"
                />
              </Box>
            </InlineStack>
          </BlockStack>
          <Divider />
          <PresetColors onSelect={onSelectPresetColor} />
          {hasFooterSave && (
            <>
              <Divider />
              <InlineStack wrap={false} blockAlign="center" gap="200" align="end">
                <Button
                  onClick={
                    typeof onClosePopup === 'function'
                      ? onClosePopup
                      : () => {
                          setVisible(false)
                        }
                  }
                >
                  {t('cancel')}
                </Button>
                <Button onClick={handleSaveFooter} variant="primary">
                  {t('save')}
                </Button>
              </InlineStack>
            </>
          )}
        </BlockStack>
      </Box>
    ),
    [
      width,
      id,
      t,
      hasFooterSave,
      onClosePopup,
      handleSaveFooter,
      colorLocalState,
      handleChangeLocalState,
      onChangeInput,
      displayValues,
      onChange,
      onSelectPresetColor,
      onBlur,
      setFocus,
      handleColorPicked,
    ]
  )

  if (!showInPopover) {
    return popoverContent
  }

  return (
    <Popover
      active={typeof defaultVisible === 'boolean' ? defaultVisible : visible}
      activator={activatorComp}
      onClose={() => {
        setVisible(false)
        onClosePopup?.()
      }}
      preventFocusOnClose
      ariaHaspopup={'dialog'}
      sectioned
      preferredPosition={preferredPosition}
      preferInputActivator
      preferredAlignment={preferredAlignment}
      fluidContent
      preventCloseOnChildOverlayClick
      zIndexOverride={1000}
    >
      {popoverContent}
    </Popover>
  )
}

export default EditorColorPicker
