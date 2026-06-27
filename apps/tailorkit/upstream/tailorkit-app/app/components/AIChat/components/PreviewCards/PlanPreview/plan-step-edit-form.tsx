/**
 * Inline edit form for a single PlanStep.
 * Editable: label, values (name + pricing), displayStyle (imageless only).
 */

import { useCallback, useState } from 'react'
import { BlockStack, Button, ButtonGroup, InlineStack, Select, Text, TextField } from '@shopify/polaris'
import { DeleteIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { PlanStep } from '~/libs/langchain/skills/types'
import styles from './styles.module.css'

interface ValueRow {
  name: string
  pricing: string
}

interface PlanStepEditFormProps {
  step: PlanStep
  onSave: (updates: Partial<PlanStep>) => void
  onCancel: () => void
}

const DISPLAY_STYLE_OPTIONS = [
  { label: 'Swatch', value: 'imageless_swatch' },
  { label: 'Checkbox', value: 'imageless_checkbox' },
  { label: 'Dropdown', value: 'imageless_dropdown_list' },
]

export function PlanStepEditForm({ step, onSave, onCancel }: PlanStepEditFormProps) {
  const { t } = useTranslation()
  const [label, setLabel] = useState(step.label)
  const [displayStyle, setDisplayStyle] = useState(step.displayStyle || 'imageless_swatch')
  const [rows, setRows] = useState<ValueRow[]>(
    step.values?.map(v => ({ name: v.name, pricing: v.pricing !== null ? String(v.pricing) : '' })) || []
  )

  const handleValueChange = useCallback((index: number, field: keyof ValueRow, value: string) => {
    setRows(prev => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)))
  }, [])

  const handleAddRow = useCallback(() => {
    setRows(prev => [...prev, { name: '', pricing: '' }])
  }, [])

  const handleRemoveRow = useCallback((index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleSave = useCallback(() => {
    const values = rows
      .filter(r => r.name.trim())
      .map(r => ({
        name: r.name.trim(),
        pricing: r.pricing ? parseFloat(r.pricing) || null : null,
      }))

    const updates: Partial<PlanStep> = { label }
    if (values.length) updates.values = values
    if (step.elementType === 'imageless') updates.displayStyle = displayStyle

    onSave(updates)
  }, [label, rows, displayStyle, step.elementType, onSave])

  return (
    <div className={styles.PlanStepEditForm}>
      <BlockStack gap="200">
        <TextField label={t('label')} value={label} onChange={setLabel} autoComplete="off" />

        {step.elementType === 'imageless' && (
          <Select
            label={t('display-style')}
            options={DISPLAY_STYLE_OPTIONS}
            value={displayStyle}
            onChange={setDisplayStyle}
          />
        )}

        {rows.length > 0 && (
          <BlockStack gap="100">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('values')}
            </Text>
            {rows.map((row, i) => (
              <div key={i} className={styles.ValueRow}>
                <InlineStack gap="100" blockAlign="center">
                  <div style={{ flex: 2 }}>
                    <TextField
                      label=""
                      labelHidden
                      placeholder={t('name')}
                      value={row.name}
                      onChange={v => handleValueChange(i, 'name', v)}
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label=""
                      labelHidden
                      placeholder={t('price')}
                      type="number"
                      value={row.pricing}
                      onChange={v => handleValueChange(i, 'pricing', v)}
                      autoComplete="off"
                    />
                  </div>
                  <Button icon={DeleteIcon} variant="plain" tone="critical" onClick={() => handleRemoveRow(i)} />
                </InlineStack>
              </div>
            ))}
          </BlockStack>
        )}

        <Button variant="plain" onClick={handleAddRow}>
          {t('add-option-value')}
        </Button>

        <ButtonGroup>
          <Button variant="primary" onClick={handleSave}>
            {t('save')}
          </Button>
          <Button onClick={onCancel}>{t('cancel')}</Button>
        </ButtonGroup>
      </BlockStack>
    </div>
  )
}
