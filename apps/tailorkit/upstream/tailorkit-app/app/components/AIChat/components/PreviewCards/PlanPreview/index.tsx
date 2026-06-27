/**
 * PlanPreviewCard — renders an ExecutionPlan as an editable ordered step list.
 * Supports step edit/remove, Apply via CommandPipeline, and Undo.
 */

import { useCallback, useRef, useState } from 'react'
import { Badge, Banner, BlockStack, Button, ButtonGroup, Card, InlineStack, Text } from '@shopify/polaris'
import { CheckIcon, ResetIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { ExecutionPlan, PlanStep } from '~/libs/langchain/skills/types'
import type { ToolCallBatch } from '~/components/AIChat/element-tools/types'
import { CommandPipeline, registerAdapters, ELEMENT_ADAPTERS } from '~/components/AIChat/element-tools'
import type { EditorContext } from '~/components/AIChat/element-tools'
import { TemplateEditorStore } from '~/stores/modules/template'
import { ELayerType } from '~/types/psd'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { convertPlanToToolCalls } from '~/libs/langchain/skills/builtin/plan-converter'
import { PlanStepItem } from './plan-step-item'
import { PlanFlagsList } from './plan-flags-list'
import { removePlanStep, updatePlanStep, getDependentSteps, countConditions } from './plan-utils'

// Register adapters once on import
registerAdapters(ELEMENT_ADAPTERS)

type CardStatus = 'idle' | 'applying' | 'applied' | 'error'
export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

interface PlanPreviewCardProps {
  plan: ExecutionPlan
  toolCallBatch?: ToolCallBatch
}

function buildEditorContext(t: (key: string) => string): EditorContext {
  const state = TemplateEditorStore.getState() as any
  const stores = state.extractedLayerStores || []

  let textCount = 0
  let imagelessCount = 0
  stores.forEach((s: any) => {
    const layerState = s.getState()
    if (layerState.type === ELayerType.TEXT) textCount++
    if (layerState.type === ELayerType.IMAGELESS) imagelessCount++
  })

  return {
    canvasWidth: state.dimension?.width || 800,
    canvasHeight: state.dimension?.height || 800,
    shopDomain: state.shopDomain || '',
    t,
    textLayerCount: textCount,
    imagelessLayerCount: imagelessCount,
    multiLayoutLayerCount: 0,
  }
}

export function PlanPreviewCard({ plan }: PlanPreviewCardProps) {
  const { t } = useTranslation()
  const elvaTracking = useFeatureTracking('ai_assistant')
  const [localPlan, setLocalPlan] = useState<ExecutionPlan>(plan)
  const [status, setStatus] = useState<CardStatus>('idle')
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [removeWarning, setRemoveWarning] = useState<string | null>(null)
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({})
  const pipelineRef = useRef<CommandPipeline | null>(null)

  const conditionCount = countConditions(localPlan)
  const isDisabled = status === 'applying' || status === 'applied'

  const handleApply = useCallback(async () => {
    setStatus('applying')
    setErrorMsg('')
    elvaTracking.trackAction('plan_applied', { step_count: localPlan.steps.length, plan_title: localPlan.title })

    try {
      const toolCalls = convertPlanToToolCalls(localPlan)
      if (!toolCalls.length) {
        setErrorMsg(t('something-went-wrong'))
        setStatus('error')
        return
      }

      // Initialize all step statuses as pending
      const initial: Record<string, StepStatus> = {}
      localPlan.steps.forEach(s => {
        initial[s.id] = 'pending'
      })
      if (localPlan.steps.some(s => s.condition)) {
        initial['conditions'] = 'pending'
      }
      setStepStatuses(initial)

      const ctx = buildEditorContext(t)
      const pipeline = new CommandPipeline()

      const result = await pipeline.executeWithProgress(toolCalls, ctx, (stepId, stepStatus) => {
        setStepStatuses(prev => ({ ...prev, [stepId]: stepStatus as StepStatus }))
      })

      if (!result.success) {
        // Mark remaining steps as skipped
        setStepStatuses(prev => {
          const next = { ...prev }
          for (const key of Object.keys(next)) {
            if (next[key] === 'pending') next[key] = 'skipped'
          }
          return next
        })
        setErrorMsg(result.errors.join('; ') || t('something-went-wrong'))
        setStatus('error')
        return
      }

      pipelineRef.current = pipeline
      setStatus('applied')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('something-went-wrong')
      setErrorMsg(message)
      setStatus('error')
    }
  }, [localPlan, t, elvaTracking])

  const handleUndo = useCallback(() => {
    if (pipelineRef.current?.canUndo()) {
      pipelineRef.current.undoLastBatch()
      pipelineRef.current = null
    }
    setStatus('idle')
    setErrorMsg('')
  }, [])

  const handleEditStep = useCallback((stepId: string) => {
    setEditingStepId(stepId)
    setRemoveWarning(null)
  }, [])

  const handleSaveStep = useCallback((stepId: string, updates: Partial<PlanStep>) => {
    setLocalPlan(prev => updatePlanStep(prev, stepId, updates))
    setEditingStepId(null)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingStepId(null)
  }, [])

  const handleRemoveStep = useCallback(
    (stepId: string) => {
      const dependents = getDependentSteps(localPlan, stepId)
      if (dependents.length > 0) {
        setRemoveWarning(t('removing-step-warning'))
      } else {
        setRemoveWarning(null)
      }
      elvaTracking.trackAction('plan_step_removed', { step_id: stepId })
      setLocalPlan(prev => removePlanStep(prev, stepId))
      setEditingStepId(null)
    },
    [localPlan, t, elvaTracking]
  )

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingSm">
            {localPlan.title}
          </Text>
          <InlineStack gap="100">
            <Badge>{t('count-steps', { count: localPlan.steps.length })}</Badge>
            {conditionCount > 0 && <Badge tone="warning">{t('count-conditions', { count: conditionCount })}</Badge>}
            {status === 'applied' && <Badge tone="success">{t('applied')}</Badge>}
          </InlineStack>
        </InlineStack>

        <BlockStack gap="0">
          {localPlan.steps.map(step => (
            <PlanStepItem
              key={step.id}
              step={step}
              allSteps={localPlan.steps}
              isEditing={editingStepId === step.id}
              onEdit={() => handleEditStep(step.id)}
              onRemove={() => handleRemoveStep(step.id)}
              onSave={updates => handleSaveStep(step.id, updates)}
              onCancelEdit={handleCancelEdit}
              disabled={isDisabled}
              stepStatus={stepStatuses[step.id]}
            />
          ))}
        </BlockStack>

        <PlanFlagsList flags={localPlan.flags} />

        {removeWarning && <Banner tone="warning">{removeWarning}</Banner>}

        {status === 'error' && <Banner tone="critical">{errorMsg || t('something-went-wrong')}</Banner>}

        <ButtonGroup>
          {status === 'applied' ? (
            <Button icon={ResetIcon} onClick={handleUndo}>
              {t('undo')}
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={CheckIcon}
              onClick={handleApply}
              disabled={isDisabled || localPlan.steps.length === 0}
              loading={status === 'applying'}
            >
              {t('apply-plan')}
            </Button>
          )}
        </ButtonGroup>
      </BlockStack>
    </Card>
  )
}
