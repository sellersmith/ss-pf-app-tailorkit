import { useState, useMemo } from 'react'
import { BlockStack, InlineStack, TextField, Select, Button, Text } from '@shopify/polaris'
import { DeleteIcon, ChevronUpIcon, ChevronDownIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { WizardStep, WizardStepItem as TWizardStepItem } from '~/types/wizard'
import type { PrintArea } from '~/types/integration'
import { Flex } from '~/components/common/Flex'
import styles from './WizardStepItem.module.css'

/** Option set enriched with layer context, friendly name, and collector index */
interface EnrichedOptionSet {
  _id: string
  index: number
  label?: string
  type?: string
  layerId: string
  layerLabel?: string
  friendlyType?: string
}

interface WizardStepItemProps {
  step: WizardStep
  stepNumber: number
  isFirst: boolean
  isLast: boolean
  allOptionSets: EnrichedOptionSet[]
  assignedItemIds: Set<string>
  printAreas: PrintArea[]
  onUpdate: (stepId: string, updates: Partial<WizardStep>) => void
  onRemove: (stepId: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export default function WizardStepItem({
  step,
  stepNumber,
  isFirst,
  isLast,
  allOptionSets,
  assignedItemIds,
  printAreas,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: WizardStepItemProps) {
  const { t } = useTranslation()
  const [pendingIndex, setPendingIndex] = useState<string>('')

  const optionSetByIndex = useMemo(() => new Map(allOptionSets.map(os => [os.index, os])), [allOptionSets])
  const optionSetById = useMemo(() => new Map(allOptionSets.map(os => [os._id, os])), [allOptionSets])

  // Track by stable itemId (survives layer reordering), NOT by elementIndex
  const currentStepItemIds = new Set(step.items.map(i => i.itemId).filter(Boolean))
  const addableOptions = [
    { label: t('choose-customization-item'), value: '' },
    ...allOptionSets
      .filter(os => !assignedItemIds.has(os._id) || currentStepItemIds.has(os._id))
      .filter(os => !currentStepItemIds.has(os._id))
      .map(os => ({
        label: `${os.friendlyType ? `[${os.friendlyType}] ` : ''}${os.label || 'Untitled'} (${os.layerLabel || 'Layer'})`,
        value: String(os.index),
      })),
  ]

  function handleAddItem(): void {
    if (pendingIndex === '') return
    const selectedIndex = Number(pendingIndex)
    const os = optionSetByIndex.get(selectedIndex)
    if (!os) return

    const newItem: TWizardStepItem = {
      elementIndex: selectedIndex,
      itemId: os._id,
      label: os.label,
    }
    onUpdate(step.id, { items: [...step.items, newItem] })
    setPendingIndex('')
  }

  function handleRemoveItem(itemId: string): void {
    onUpdate(step.id, { items: step.items.filter(i => i.itemId !== itemId) })
  }

  return (
    <div className={styles.stepContent}>
      <BlockStack gap="200">
        {/* Header: step number + name + actions */}
        <InlineStack align="space-between" blockAlign="center" gap="200" wrap={false}>
          {/* Left: badge + title */}
          <Flex align="center" gap="8px" grow={1} minWidth="0" style={{ overflow: 'hidden' }}>
            <Flex
              align="center"
              justify="center"
              shrink={0}
              style={{
                background: 'var(--p-color-bg-fill-brand)',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
              }}
            >
              <Text as="span" variant="bodySm" fontWeight="bold" tone="text-inverse">
                {stepNumber}
              </Text>
            </Flex>
            <Text as="span" variant="bodyMd" fontWeight="semibold" truncate>
              {step.label || t('untitled-step')}
            </Text>
          </Flex>
          <InlineStack blockAlign="center" gap="0">
            <Button
              variant="plain"
              icon={ChevronUpIcon}
              disabled={isFirst}
              onClick={onMoveUp}
              accessibilityLabel={t('move-up')}
            />
            <Button
              variant="plain"
              icon={ChevronDownIcon}
              disabled={isLast}
              onClick={onMoveDown}
              accessibilityLabel={t('move-down')}
            />
            <Button
              variant="plain"
              icon={DeleteIcon}
              tone="critical"
              onClick={() => onRemove(step.id)}
              accessibilityLabel={t('delete-step')}
            />
          </InlineStack>
        </InlineStack>

        {/* Step name input */}
        <TextField
          label={t('step-name')}
          labelHidden
          value={step.label}
          onChange={val => onUpdate(step.id, { label: val })}
          autoComplete="off"
          placeholder={t('e-g-choose-material')}
          size="slim"
        />

        {/* Content items */}
        {step.items.length > 0 && (
          <BlockStack gap="100">
            {step.items.map(item => {
              const os = optionSetById.get(item.itemId)
              return (
                <InlineStack key={item.itemId} align="space-between" blockAlign="center">
                  <InlineStack gap="100" blockAlign="center" wrap={false}>
                    <Text as="span" variant="bodySm">
                      {item.label || os?.label || os?.friendlyType || item.itemId}
                    </Text>
                    {os?.friendlyType && (
                      <Text as="span" variant="bodySm" tone="subdued">
                        · {os.friendlyType}
                      </Text>
                    )}
                  </InlineStack>
                  <Button
                    variant="plain"
                    tone="critical"
                    size="slim"
                    onClick={() => handleRemoveItem(item.itemId)}
                    accessibilityLabel={t('remove')}
                  >
                    ×
                  </Button>
                </InlineStack>
              )
            })}
          </BlockStack>
        )}

        {/* Add option set — select grows, button stays fixed width */}
        {addableOptions.length > 1 && (
          <Flex align="flex-end" gap="8px" wrap="nowrap">
            <Flex grow={1} shrink={1} minWidth="0" style={{ overflow: 'hidden', width: 0 }}>
              <Select
                label={t('add-content')}
                labelHidden
                options={addableOptions}
                value={pendingIndex}
                onChange={setPendingIndex}
              />
            </Flex>
            <Flex shrink={0}>
              <Button onClick={handleAddItem} disabled={pendingIndex === ''} size="slim">
                {t('add')}
              </Button>
            </Flex>
          </Flex>
        )}
      </BlockStack>
    </div>
  )
}
