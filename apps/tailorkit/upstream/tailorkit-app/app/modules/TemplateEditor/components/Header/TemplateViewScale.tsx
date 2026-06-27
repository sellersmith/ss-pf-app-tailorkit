import { Box, Button, Icon, InlineStack, Popover, RangeSlider, TextField, Tooltip } from '@shopify/polaris'
import { SearchRecentIcon } from '@shopify/polaris-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'

export function TemplateViewScale() {
  const { t } = useTranslation()

  const [popoverActive, setPopoverActive] = useState(false)
  const viewport = useStore(TemplateEditorStore, state => state.viewport)
  const scale = viewport.scale
  const [tempVal, setTempVal] = useState(scale)
  const debounceTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (popoverActive) {
      setTempVal(scale)
    }
  }, [popoverActive, scale])

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [])

  function onInputChange(val: string) {
    setTempVal(+val / 100)
  }

  function onSliderChange(value: number) {
    const scaleValue = value / 100

    // Update local state immediately for smooth visual feedback
    setTempVal(scaleValue)

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Debounce the store update to improve performance
    debounceTimeoutRef.current = setTimeout(() => {
      TemplateEditorStore.dispatch({
        type: 'SET_VIEW_PORT',
        payload: { viewport: { ...viewport, scale: scaleValue } },
        skipTrace: true,
      })
    }, 100) // 100ms debounce delay
  }

  function onChange(val: string) {
    let _val = +val
    if (_val < 0.01 || !_val) {
      _val = 0.01
    }

    // Clear any pending debounced updates
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    setTempVal(_val)

    TemplateEditorStore.dispatch({
      type: 'SET_VIEW_PORT',
      payload: { viewport: { ...viewport, scale: _val } },
      skipTrace: true,
    })
  }

  const togglePopoverActive = useCallback(() => setPopoverActive(popoverActive => !popoverActive), [])

  const scaleStr = Math.round(scale * 100).toString()
  const tempScaleStr = Math.round(tempVal * 100).toString()

  const activator = (
    <Tooltip content={t('zoom-in-out-template')}>
      <Button
        fullWidth
        onClick={togglePopoverActive}
        variant="tertiary"
        textAlign="start"
        icon={<Icon source={SearchRecentIcon} tone="base" />}
      >
        {scaleStr}%
      </Button>
    </Tooltip>
  )

  return (
    <Popover
      active={popoverActive}
      activator={activator}
      onClose={() => {
        // Clear any pending debounced updates and apply final value
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current)
        }
        onChange(tempVal.toString())
        togglePopoverActive()
      }}
    >
      <Box padding={'400'}>
        <InlineStack gap="400" align="end" blockAlign="end" wrap={false}>
          {/* Slider for quick zoom adjustment */}
          <Box minWidth="200px">
            <RangeSlider
              label={t('zoom-level')}
              value={Math.round(tempVal * 100)}
              min={10}
              max={500}
              onChange={onSliderChange}
              output
            />
          </Box>

          {/* Text input for precise zoom control */}
          <Box maxWidth="60px">
            <div
              className="tailorkit-input_field"
              onKeyDown={e => {
                const key = e.key
                if (key === 'Enter') {
                  onChange(tempVal.toString())
                }
              }}
            >
              <TextField
                label={t('input')}
                labelHidden
                autoComplete="off"
                value={tempScaleStr}
                onChange={onInputChange}
                type="number"
                suffix="%"
              />
            </div>
          </Box>
        </InlineStack>
      </Box>
    </Popover>
  )
}
