/**
 * FillSection - Fill/gradient controls for the sidebar
 * Extracted from GradientPopover, without the Popover wrapper
 */

import { useState, useCallback, useMemo } from 'react'
import {
  Box,
  Button,
  BlockStack,
  InlineStack,
  Text,
  ButtonGroup,
  TextField,
  Select,
  ColorPicker,
  hsbToHex,
  hexToRgb,
} from '@shopify/polaris'
import { PlusIcon, DeleteIcon } from '@shopify/polaris-icons'
import EditorColorPicker from '~/components/common/ColorPicker'
import type { GradientDef, GradientStop, LinearGradientDef, RadialGradientDef } from '../../types'
import { createLinearGradient, createRadialGradient, generateDefId } from '../../utils/svg'
import { useTranslation } from 'react-i18next'
import type { FillSectionProps } from './types'
import styles from './styles.module.css'

type FillType = 'solid' | 'linear' | 'radial'
type GradientType = 'linearGradient' | 'radialGradient'

interface EditingGradient {
  id: string
  type: GradientType
  stops: GradientStop[]
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  cx?: number
  cy?: number
  r?: number
}

export default function FillSection({
  selectedPath,
  defs,
  disabled,
  onFillColorChange,
  onFillRuleChange,
  onGradientCreate,
  onGradientUpdate,
  onGradientDelete,
  onFillGradientApply,
}: FillSectionProps) {
  const { t } = useTranslation()

  const [editingGradient, setEditingGradient] = useState<EditingGradient | null>(null)
  const [selectedStopIndex, setSelectedStopIndex] = useState(0)
  const [stopColorPickerActive, setStopColorPickerActive] = useState(false)

  // Get all gradients
  const gradients = useMemo(() => Array.from(defs.gradients.values()), [defs.gradients])

  // Determine current fill type and color
  const currentFillInfo = useMemo(() => {
    if (!selectedPath) return { type: 'solid' as FillType, color: '#000000', gradientId: null }

    const fill = selectedPath.style.fill
    if (fill.type === 'gradient') {
      const gradient = defs.gradients.get(fill.gradientId)
      return {
        type: (gradient?.type === 'linearGradient' ? 'linear' : 'radial') as FillType,
        color: 'gradient',
        gradientId: fill.gradientId,
      }
    }
    return {
      type: 'solid' as FillType,
      color: fill.type === 'color' ? fill.color : 'none',
      gradientId: null,
    }
  }, [selectedPath, defs.gradients])

  // Handle fill type change
  const handleFillTypeChange = useCallback(
    (newType: FillType) => {
      if (newType === 'solid') {
        onFillColorChange(currentFillInfo.color === 'gradient' ? '#000000' : currentFillInfo.color)
        setEditingGradient(null)
      } else {
        const gradientType: GradientType = newType === 'linear' ? 'linearGradient' : 'radialGradient'
        const id = generateDefId('grad', defs)
        const defaultStops: GradientStop[] = [
          { offset: 0, color: '#000000' },
          { offset: 1, color: '#ffffff' },
        ]

        if (gradientType === 'linearGradient') {
          const gradient = createLinearGradient(id, defaultStops, 0, 0, 1, 0)
          onGradientCreate(gradient)
          setEditingGradient({ id, type: gradientType, stops: defaultStops, x1: 0, y1: 0, x2: 1, y2: 0 })
        } else {
          const gradient = createRadialGradient(id, defaultStops, 0.5, 0.5, 0.5)
          onGradientCreate(gradient)
          setEditingGradient({ id, type: gradientType, stops: defaultStops, cx: 0.5, cy: 0.5, r: 0.5 })
        }
        onFillGradientApply(id)
        setSelectedStopIndex(0)
      }
    },
    [currentFillInfo.color, defs, onFillColorChange, onGradientCreate, onFillGradientApply]
  )

  // Select existing gradient for editing
  const handleSelectGradient = useCallback(
    (gradient: GradientDef) => {
      if (gradient.type === 'linearGradient') {
        setEditingGradient({
          id: gradient.id,
          type: gradient.type,
          stops: [...gradient.stops],
          x1: gradient.x1,
          y1: gradient.y1,
          x2: gradient.x2,
          y2: gradient.y2,
        })
      } else {
        setEditingGradient({
          id: gradient.id,
          type: gradient.type,
          stops: [...gradient.stops],
          cx: gradient.cx,
          cy: gradient.cy,
          r: gradient.r,
        })
      }
      onFillGradientApply(gradient.id)
      setSelectedStopIndex(0)
    },
    [onFillGradientApply]
  )

  // Update stop color immediately for real-time visual feedback
  const handleStopColorChange = useCallback(
    (hsb: { hue: number; saturation: number; brightness: number }) => {
      if (!editingGradient) return

      const hexColor = hsbToHex(hsb)
      const newStops = [...editingGradient.stops]
      newStops[selectedStopIndex] = { ...newStops[selectedStopIndex], color: hexColor }

      const newEditingGradient = { ...editingGradient, stops: newStops }
      setEditingGradient(newEditingGradient)

      // Update immediately for real-time visual feedback
      if (newEditingGradient.type === 'linearGradient') {
        onGradientUpdate(newEditingGradient.id, {
          stops: newStops,
          x1: newEditingGradient.x1,
          y1: newEditingGradient.y1,
          x2: newEditingGradient.x2,
          y2: newEditingGradient.y2,
        } as Partial<LinearGradientDef>)
      } else {
        onGradientUpdate(newEditingGradient.id, {
          stops: newStops,
          cx: newEditingGradient.cx,
          cy: newEditingGradient.cy,
          r: newEditingGradient.r,
        } as Partial<RadialGradientDef>)
      }
    },
    [editingGradient, selectedStopIndex, onGradientUpdate]
  )

  // Update stop offset immediately for real-time visual feedback
  const handleStopOffsetChange = useCallback(
    (value: string, index: number) => {
      if (!editingGradient) return

      const offset = Math.max(0, Math.min(1, parseFloat(value) / 100 || 0))
      const newStops = [...editingGradient.stops]
      newStops[index] = { ...newStops[index], offset }

      const newEditingGradient = { ...editingGradient, stops: newStops }
      setEditingGradient(newEditingGradient)
      onGradientUpdate(newEditingGradient.id, { stops: newStops })
    },
    [editingGradient, onGradientUpdate]
  )

  // Add stop
  const handleAddStop = useCallback(() => {
    if (!editingGradient) return

    const newStop: GradientStop = { offset: 0.5, color: '#808080' }
    const newStops = [...editingGradient.stops, newStop].sort((a, b) => a.offset - b.offset)

    const newEditingGradient = { ...editingGradient, stops: newStops }
    setEditingGradient(newEditingGradient)
    setSelectedStopIndex(newStops.findIndex(s => s === newStop))
    onGradientUpdate(newEditingGradient.id, { stops: newStops })
  }, [editingGradient, onGradientUpdate])

  // Remove stop
  const handleRemoveStop = useCallback(
    (index: number) => {
      if (!editingGradient || editingGradient.stops.length <= 2) return

      const newStops = editingGradient.stops.filter((_, i) => i !== index)
      const newEditingGradient = { ...editingGradient, stops: newStops }
      setEditingGradient(newEditingGradient)
      setSelectedStopIndex(Math.min(selectedStopIndex, newStops.length - 1))
      onGradientUpdate(newEditingGradient.id, { stops: newStops })
    },
    [editingGradient, selectedStopIndex, onGradientUpdate]
  )

  // Handle direction change for linear gradients
  const handleDirectionChange = useCallback(
    (direction: string) => {
      if (!editingGradient || editingGradient.type !== 'linearGradient') return

      let x1 = 0
      let y1 = 0
      let x2 = 1
      let y2 = 0
      switch (direction) {
        case 'vertical':
          x1 = 0
          y1 = 0
          x2 = 0
          y2 = 1
          break
        case 'diagonal':
          x1 = 0
          y1 = 0
          x2 = 1
          y2 = 1
          break
        case 'diagonal-reverse':
          x1 = 1
          y1 = 0
          x2 = 0
          y2 = 1
          break
        default:
          x1 = 0
          y1 = 0
          x2 = 1
          y2 = 0
      }

      const newEditingGradient = { ...editingGradient, x1, y1, x2, y2 }
      setEditingGradient(newEditingGradient)
      onGradientUpdate(newEditingGradient.id, { x1, y1, x2, y2 } as Partial<LinearGradientDef>)
    },
    [editingGradient, onGradientUpdate]
  )

  // Get current direction value
  const getCurrentDirection = useCallback(() => {
    if (!editingGradient || editingGradient.type !== 'linearGradient') return 'horizontal'
    const { x1, y1, x2, y2 } = editingGradient
    if (x1 === 0 && y1 === 0 && x2 === 0 && y2 === 1) return 'vertical'
    if (x1 === 0 && y1 === 0 && x2 === 1 && y2 === 1) return 'diagonal'
    if (x1 === 1 && y1 === 0 && x2 === 0 && y2 === 1) return 'diagonal-reverse'
    return 'horizontal'
  }, [editingGradient])

  // Build gradient preview CSS
  const getGradientPreviewStyle = useCallback((gradient: EditingGradient | GradientDef): React.CSSProperties => {
    const stops = gradient.stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ')

    if (gradient.type === 'linearGradient') {
      const g = gradient as LinearGradientDef | EditingGradient
      const angle = Math.atan2((g.y2 ?? 0) - (g.y1 ?? 0), (g.x2 ?? 1) - (g.x1 ?? 0)) * (180 / Math.PI)
      return { background: `linear-gradient(${angle + 90}deg, ${stops})` }
    }
    return { background: `radial-gradient(circle, ${stops})` }
  }, [])

  // Parse color to HSB for color picker
  const selectedStopHsb = useMemo(() => {
    if (!editingGradient || !editingGradient.stops[selectedStopIndex]) {
      return { hue: 0, saturation: 0, brightness: 0 }
    }

    const color = editingGradient.stops[selectedStopIndex].color
    const rgb = hexToRgb(color)
    if (!rgb) return { hue: 0, saturation: 0, brightness: 0 }

    const r = rgb.red / 255
    const g = rgb.green / 255
    const b = rgb.blue / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const d = max - min

    let h = 0
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      else if (max === g) h = ((b - r) / d + 2) / 6
      else h = ((r - g) / d + 4) / 6
    }

    const s = max === 0 ? 0 : d / max
    const v = max

    return { hue: h * 360, saturation: s, brightness: v }
  }, [editingGradient, selectedStopIndex])

  // Delete gradient
  const handleDeleteGradient = useCallback(() => {
    if (!editingGradient) return
    onGradientDelete(editingGradient.id)
    setEditingGradient(null)
    onFillColorChange('#000000')
  }, [editingGradient, onGradientDelete, onFillColorChange])

  if (disabled) {
    return (
      <Box padding="300">
        <Text as="p" tone="subdued">
          {t('select-a-path-to-edit-fill')}
        </Text>
      </Box>
    )
  }

  return (
    <BlockStack gap="300">
      {/* Fill Type Selector */}
      <BlockStack gap="200">
        <Text as="span" variant="headingSm">
          {t('fill-type')}
        </Text>
        <ButtonGroup variant="segmented" fullWidth>
          <Button pressed={currentFillInfo.type === 'solid'} onClick={() => handleFillTypeChange('solid')}>
            {t('solid')}
          </Button>
          <Button pressed={currentFillInfo.type === 'linear'} onClick={() => handleFillTypeChange('linear')}>
            {t('linear')}
          </Button>
          <Button pressed={currentFillInfo.type === 'radial'} onClick={() => handleFillTypeChange('radial')}>
            {t('radial')}
          </Button>
        </ButtonGroup>
      </BlockStack>

      {/* Fill Rule Selector */}
      {onFillRuleChange && (
        <BlockStack gap="200">
          <Text as="span" variant="headingSm">
            {t('fill-rule')}
          </Text>
          <ButtonGroup variant="segmented" fullWidth>
            <Button pressed={selectedPath?.style.fillRule !== 'evenodd'} onClick={() => onFillRuleChange('nonzero')}>
              {t('non-zero')}
            </Button>
            <Button pressed={selectedPath?.style.fillRule === 'evenodd'} onClick={() => onFillRuleChange('evenodd')}>
              {t('even-odd')}
            </Button>
          </ButtonGroup>
          <Text as="span" variant="bodySm" tone="subdued">
            {selectedPath?.style.fillRule === 'evenodd' ? t('even-odd-creates-holes') : t('non-zero-fills-all')}
          </Text>
        </BlockStack>
      )}

      {/* Solid Color Picker */}
      {currentFillInfo.type === 'solid' && (
        <BlockStack gap="200">
          <EditorColorPicker
            value={currentFillInfo.color === 'none' ? '' : currentFillInfo.color}
            showInPopover={false}
            onChange={onFillColorChange}
            onClear={() => onFillColorChange('none')}
          />
          {currentFillInfo.color !== 'none' && (
            <Button icon={DeleteIcon} tone="critical" onClick={() => onFillColorChange('none')}>
              {t('remove-fill')}
            </Button>
          )}
        </BlockStack>
      )}

      {/* Gradient Editor */}
      {(currentFillInfo.type === 'linear' || currentFillInfo.type === 'radial') && (
        <BlockStack gap="300">
          {/* Existing Gradients */}
          {gradients.length > 0 && (
            <BlockStack gap="200">
              <Text as="span" variant="bodySm" tone="subdued">
                {t('saved-gradients')}
              </Text>
              <InlineStack gap="100" wrap>
                {gradients.map(gradient => (
                  <div
                    key={gradient.id}
                    className={`${styles.gradientSwatch} ${currentFillInfo.gradientId === gradient.id ? styles.gradientSwatchActive : ''}`}
                    style={getGradientPreviewStyle(gradient)}
                    onClick={() => handleSelectGradient(gradient)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && handleSelectGradient(gradient)}
                    title={gradient.id}
                  />
                ))}
              </InlineStack>
            </BlockStack>
          )}

          {/* Gradient Preview */}
          {editingGradient && (
            <>
              <div className={styles.gradientPreviewBar} style={getGradientPreviewStyle(editingGradient)} />

              {/* Direction for Linear */}
              {editingGradient.type === 'linearGradient' && (
                <Select
                  label={t('direction')}
                  labelInline
                  options={[
                    { label: t('horizontal'), value: 'horizontal' },
                    { label: t('vertical'), value: 'vertical' },
                    { label: t('diagonal'), value: 'diagonal' },
                    { label: t('diagonal-reverse'), value: 'diagonal-reverse' },
                  ]}
                  value={getCurrentDirection()}
                  onChange={handleDirectionChange}
                />
              )}

              {/* Color Stops */}
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {t('color-stops')}
                  </Text>
                  <Button icon={PlusIcon} size="slim" variant="plain" onClick={handleAddStop}>
                    {t('add')}
                  </Button>
                </InlineStack>

                {editingGradient.stops.map((stop, index) => (
                  <BlockStack key={index} gap="100">
                    <InlineStack gap="200" blockAlign="center">
                      <div
                        className={`${styles.stopColorSwatch} ${
                          stopColorPickerActive && selectedStopIndex === index ? styles.stopColorSwatchSelected : ''
                        }`}
                        style={{ backgroundColor: stop.color }}
                        onClick={() => {
                          if (selectedStopIndex === index) {
                            setStopColorPickerActive(prev => !prev)
                          } else {
                            setSelectedStopIndex(index)
                            setStopColorPickerActive(true)
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            if (selectedStopIndex === index) {
                              setStopColorPickerActive(prev => !prev)
                            } else {
                              setSelectedStopIndex(index)
                              setStopColorPickerActive(true)
                            }
                          }
                        }}
                      />

                      <div style={{ width: 60 }}>
                        <TextField
                          label=""
                          labelHidden
                          type="number"
                          value={String(Math.round(stop.offset * 100))}
                          onChange={value => handleStopOffsetChange(value, index)}
                          suffix="%"
                          autoComplete="off"
                        />
                      </div>

                      {editingGradient.stops.length > 2 && (
                        <Button
                          icon={DeleteIcon}
                          variant="plain"
                          tone="critical"
                          size="slim"
                          onClick={() => handleRemoveStop(index)}
                          accessibilityLabel={t('remove-stop')}
                        />
                      )}
                    </InlineStack>

                    {stopColorPickerActive && selectedStopIndex === index && (
                      <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                        <ColorPicker color={selectedStopHsb} onChange={handleStopColorChange} />
                      </Box>
                    )}
                  </BlockStack>
                ))}
              </BlockStack>

              {/* Delete Gradient */}
              <Button icon={DeleteIcon} tone="critical" onClick={handleDeleteGradient}>
                {t('delete-gradient')}
              </Button>
            </>
          )}
        </BlockStack>
      )}
    </BlockStack>
  )
}
