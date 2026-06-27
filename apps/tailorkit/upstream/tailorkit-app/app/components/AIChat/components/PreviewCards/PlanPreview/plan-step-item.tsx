/**
 * Single plan step row — view mode + inline edit mode.
 */

import { Badge, BlockStack, Box, Button, Icon, InlineStack, Spinner, Text } from '@shopify/polaris'
import { CheckCircleIcon, DeleteIcon, EditIcon, XCircleIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { PlanStep } from '~/libs/langchain/skills/types'
import type { StepStatus } from './index'
import { PlanStepEditForm } from './plan-step-edit-form'
import styles from './styles.module.css'

interface PlanStepItemProps {
  step: PlanStep
  allSteps: PlanStep[]
  isEditing: boolean
  onEdit: () => void
  onRemove: () => void
  onSave: (updates: Partial<PlanStep>) => void
  onCancelEdit: () => void
  disabled: boolean
  stepStatus?: StepStatus
}

const ELEMENT_TYPE_LABELS: Record<string, string> = {
  imageless: 'Radio/Swatch',
  imageless_checkbox: 'Checkbox',
  imageless_dropdown_list: 'Dropdown',
  text_customer: 'Text Input',
  image: 'Image Upload',
  text: 'Text',
}

const ELEMENT_TYPE_TONES: Record<string, 'info' | 'success' | 'warning' | 'attention'> = {
  imageless: 'info',
  text_customer: 'success',
  image: 'info',
  text: 'warning',
}

function resolveTypeLabel(step: PlanStep): string {
  if (step.elementType === 'imageless' && step.displayStyle) {
    return ELEMENT_TYPE_LABELS[step.displayStyle] || ELEMENT_TYPE_LABELS.imageless
  }
  return ELEMENT_TYPE_LABELS[step.elementType] || step.elementType
}

/** Render step execution status indicator */
function StepStatusIndicator({ status }: { status?: StepStatus }) {
  if (!status || status === 'pending') return null
  if (status === 'running') return <Spinner size="small" />
  if (status === 'done') return <Icon source={CheckCircleIcon} tone="success" />
  if (status === 'failed') return <Icon source={XCircleIcon} tone="critical" />
  if (status === 'skipped') return <Badge tone="new">Skipped</Badge>
  return null
}

export function PlanStepItem({
  step,
  allSteps,
  isEditing,
  onEdit,
  onRemove,
  onSave,
  onCancelEdit,
  disabled,
  stepStatus,
}: PlanStepItemProps) {
  const { t } = useTranslation()

  const isConditional = step.condition !== null
  const containerClass = `${styles.PlanStepItem} ${isConditional ? styles.PlanStepConditional : ''}`

  const visibleValues = step.values?.slice(0, 3) || []
  const remainingCount = (step.values?.length || 0) - 3

  const sourceStep = step.condition ? allSteps.find(s => s.id === step.condition!.dependsOnStep) : null

  const typeTone = ELEMENT_TYPE_TONES[step.elementType] || 'info'
  const typeLabel = resolveTypeLabel(step)

  if (isEditing) {
    return (
      <div className={containerClass}>
        <PlanStepEditForm step={step} onSave={onSave} onCancel={onCancelEdit} />
      </div>
    )
  }

  return (
    <div className={containerClass}>
      <BlockStack gap="100">
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <InlineStack gap="200" blockAlign="center">
            <Text as="span" variant="bodySm" fontWeight="semibold">
              {step.order}.
            </Text>
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {step.label}
            </Text>
            <Badge tone={typeTone}>{typeLabel}</Badge>
          </InlineStack>

          {stepStatus ? (
            <StepStatusIndicator status={stepStatus} />
          ) : !disabled ? (
            <InlineStack gap="100">
              <Button icon={EditIcon} variant="plain" size="slim" onClick={onEdit} />
              <Button icon={DeleteIcon} variant="plain" tone="critical" size="slim" onClick={onRemove} />
            </InlineStack>
          ) : null}
        </InlineStack>

        {visibleValues.length > 0 ? (
          <Box paddingInlineStart="400">
            <Text as="span" variant="bodySm" tone="subdued">
              <span className={styles.PlanStepValues}>
                {visibleValues.map((v, i) => {
                  const pricing = v.pricing !== null && v.pricing > 0 ? ` (+$${v.pricing})` : ''
                  return (i > 0 ? ', ' : '') + v.name + pricing
                })}
                {remainingCount > 0 && ` +${remainingCount} ${t('more')}`}
              </span>
            </Text>
          </Box>
        ) : step.elementType === 'image' ? (
          <Box paddingInlineStart="400">
            <Text as="span" variant="bodySm" tone="subdued">
              {t('buyers-can-upload-their-own-images')}
            </Text>
          </Box>
        ) : step.elementType === 'text_customer' && step.settings?.placeholder ? (
          <Box paddingInlineStart="400">
            <Text as="span" variant="bodySm" tone="subdued">
              {step.settings.placeholder}
            </Text>
          </Box>
        ) : null}

        {isConditional && sourceStep && (
          <Box paddingInlineStart="400">
            <Badge tone="warning">
              {step.condition!.action === 'show'
                ? `${t('show-when')} ${sourceStep.label} = "${step.condition!.whenValue}"`
                : `${t('hide-when')} ${sourceStep.label} = "${step.condition!.whenValue}"`}
            </Badge>
          </Box>
        )}
      </BlockStack>
    </div>
  )
}
