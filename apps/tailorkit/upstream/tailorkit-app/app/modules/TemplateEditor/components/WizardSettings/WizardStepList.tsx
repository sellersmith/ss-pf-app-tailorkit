import { Banner, BlockStack, Button, Text, Box } from '@shopify/polaris'
import { PlusIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import type { WizardStep } from '~/types/wizard'
import type { PrintArea } from '~/types/integration'
import type { CollectorLayer } from '~/shared/customization-items'
import { collectCustomizationItems, CUSTOMIZATION_TYPE_LABELS } from '~/shared/customization-items'
import { SortableList } from '~/components/common/SortableList/SortableList'
import WizardStepItem from './WizardStepItem'
import { createEmptyStep, MAX_WIZARD_STEPS } from './wizard-settings-utils'

interface WizardStepListProps {
  steps: WizardStep[]
  layers: CollectorLayer[]
  printAreas: PrintArea[]
  onReorder: (steps: WizardStep[]) => void
  onStepUpdate: (stepId: string, updates: Partial<WizardStep>) => void
  onStepRemove: (stepId: string) => void
  onAddStep: (step: WizardStep) => void
}

export default function WizardStepList({
  steps,
  layers,
  printAreas,
  onReorder,
  onStepUpdate,
  onStepRemove,
  onAddStep,
}: WizardStepListProps) {
  const { t } = useTranslation()

  // Collect ALL customization items using the unified collector
  const allCustomizationItems = useMemo(() => collectCustomizationItems(layers), [layers])

  // Map to the shape WizardStepItem expects, including index
  const allOptionSets = useMemo(
    () =>
      allCustomizationItems.map((item, index) => ({
        _id: item.id,
        index,
        label: item.label,
        type: item.type,
        layerId: item.layerId,
        layerLabel: item.layerLabel,
        friendlyType: CUSTOMIZATION_TYPE_LABELS[item.type] || item.type,
        hasData: item.hasData,
      })),
    [allCustomizationItems]
  )

  const assignedItemIds = useMemo(
    () => new Set(steps.flatMap(s => s.items.map(i => i.itemId).filter(Boolean))),
    [steps]
  )
  // O(1) Map lookup vs O(n) findIndex for each step render
  const stepIndexMap = useMemo(() => new Map(steps.map((s, idx) => [s.id, idx])), [steps])
  const unassignedCount = allOptionSets.filter(os => !assignedItemIds.has(os._id)).length

  function moveStep(index: number, direction: 'up' | 'down'): void {
    const next = [...steps]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= next.length) return
    ;[next[index], next[targetIndex]] = [next[targetIndex], next[index]]
    onReorder(next)
  }

  function handleAssignAll(): void {
    if (steps.length >= MAX_WIZARD_STEPS) return
    const unassignedItems = allOptionSets.filter(os => !assignedItemIds.has(os._id))
    const newStep = createEmptyStep(t('other'))
    newStep.items = unassignedItems.map(os => ({
      elementIndex: os.index,
      itemId: os._id,
      label: os.label,
    }))
    onAddStep(newStep)
  }

  const emptyStateText = t(
    "Split personalization into guided steps so customers aren't overwhelmed "
      + 'by all options at once. Each step shows only the relevant customization items.'
  )

  if (steps.length === 0) {
    return (
      <BlockStack gap="300">
        <Box background="bg-surface-secondary" padding="400" borderRadius="200">
          <BlockStack gap="200" inlineAlign="center">
            <Text as="p" variant="bodySm" tone="subdued" alignment="center">
              {emptyStateText}
            </Text>
            <Button icon={PlusIcon} onClick={() => onAddStep(createEmptyStep())}>
              {t('add-step')}
            </Button>
          </BlockStack>
        </Box>
      </BlockStack>
    )
  }

  return (
    <BlockStack gap="200">
      {unassignedCount > 0 && (
        <Banner tone="info" action={{ content: t('assign-all'), onAction: handleAssignAll }}>
          <Text as="p" variant="bodySm">
            {t('count-items-not-in-any-step-yet-unassigned-items-won-t-appear-on-the-storefront', {
              count: unassignedCount,
            })}
          </Text>
        </Banner>
      )}

      <SortableList
        items={steps}
        onChange={onReorder}
        renderItem={step => {
          const index = stepIndexMap.get(step.id)
          if (index === undefined) {
            console.warn(`[WizardStepList] Step ${step.id} not found in stepIndexMap`)
            return null
          }
          return (
            <SortableList.Item
              id={step.id}
              className="always-visible-actions"
              styles={{
                padding: 0,
                background: 'var(--p-color-bg-surface)',
                border: 'var(--p-border-width-025) solid var(--p-color-border)',
                borderRadius: 'var(--p-border-radius-200)',
                alignItems: 'stretch',
              }}
            >
              <SortableList.DragHandle
                style={{ alignSelf: 'center', padding: '0 4px' }}
                aria-label={t('drag-to-reorder-step')}
              />
              <WizardStepItem
                step={step}
                stepNumber={index + 1}
                isFirst={index === 0}
                isLast={index === steps.length - 1}
                allOptionSets={allOptionSets}
                assignedItemIds={assignedItemIds}
                printAreas={printAreas}
                onUpdate={onStepUpdate}
                onRemove={onStepRemove}
                onMoveUp={() => moveStep(index, 'up')}
                onMoveDown={() => moveStep(index, 'down')}
              />
            </SortableList.Item>
          )
        }}
      />

      {steps.length < MAX_WIZARD_STEPS && (
        <Button icon={PlusIcon} onClick={() => onAddStep(createEmptyStep())} fullWidth>
          {t('add-step')}
        </Button>
      )}
    </BlockStack>
  )
}
