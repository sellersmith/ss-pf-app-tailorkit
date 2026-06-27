/**
 * Preview card for AI-generated option sets.
 * Detects toolCallBatch → uses CommandPipeline (new path).
 * Falls back to legacy ApplyPayload if no toolCallBatch.
 * Supports Undo after Apply.
 */

import { useCallback, useRef, useState } from 'react'
import { Badge, Banner, BlockStack, Box, Button, ButtonGroup, Card, InlineStack, Text } from '@shopify/polaris'
import { CheckIcon, EditIcon, XIcon, ResetIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { SkillResultBlock } from '~/components/AIChat/fns'
import { TemplateEditorStore } from '~/stores/modules/template'
import { CommandPipeline, registerAdapters, ELEMENT_ADAPTERS } from '~/components/AIChat/element-tools'
import type { EditorContext, ToolCall } from '~/components/AIChat/element-tools'
import { ELayerType } from '~/types/psd'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import styles from './styles.module.css'

// Register adapters on first import
registerAdapters(ELEMENT_ADAPTERS)

interface OptionSetPreviewCardProps {
  skillResult: SkillResultBlock['data']
  onEdit?: (text: string) => void
}

type CardStatus = 'idle' | 'applying' | 'applied' | 'cancelled' | 'error' | 'undone'

const DISPLAY_STYLE_LABELS: Record<string, string> = {
  imageless_swatch: 'Radio',
  imageless_checkbox: 'Checkbox',
  imageless_dropdown_list: 'Dropdown',
  text_input: 'Text Input',
}

const TYPE_BADGE_TONE: Record<string, 'info' | 'success' | 'warning' | 'attention'> = {
  imageless_option: 'info',
  text_option: 'success',
  text_customer: 'success',
  color_option: 'warning',
  image_option: 'attention',
  image_buyer: 'attention',
  font_option: 'info',
}

/** Build EditorContext from current template editor state */
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

export function OptionSetPreviewCard({ skillResult, onEdit }: OptionSetPreviewCardProps) {
  const { t } = useTranslation()
  const { trackAction } = useFeatureTracking('ai_assistant')
  const [status, setStatus] = useState<CardStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const pipelineRef = useRef<CommandPipeline | null>(null)

  const { preview, data: applyPayload } = skillResult

  const handleApply = useCallback(() => {
    if (!applyPayload) return
    setStatus('applying')

    try {
      const toolCallBatch = applyPayload.toolCallBatch
      if (toolCallBatch?.calls?.length) {
        // New path: Command Pipeline with adapters
        const ctx = buildEditorContext(t)
        const pipeline = new CommandPipeline()
        const result = pipeline.executeBatch(toolCallBatch.calls as ToolCall[], ctx)

        if (!result.success) {
          setErrorMsg(result.errors.join('; ') || 'Pipeline execution failed')
          setStatus('error')
          return
        }

        // Track font/color customizations applied by AI
        const calls = toolCallBatch.calls as ToolCall[]
        calls.forEach(call => {
          if (call.name === 'set_customization') {
            const osType = call.args?.type as string | undefined
            if (osType === 'font_option' || osType === 'color_option') {
              trackAction('customization_applied', { customization_type: osType })
            }
          }
        })

        pipelineRef.current = pipeline
        setStatus('applied')
      } else {
        setErrorMsg('No tool calls in response')
        setStatus('error')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply')
      setStatus('error')
    }
  }, [applyPayload, t, trackAction])

  const handleUndo = useCallback(() => {
    if (pipelineRef.current?.canUndo()) {
      pipelineRef.current.undoLastBatch()
      pipelineRef.current = null
      setStatus('idle')
    }
  }, [])

  const handleCancel = useCallback(() => {
    setStatus('cancelled')
  }, [])

  const handleEdit = useCallback(() => {
    onEdit?.('Edit the option sets: ')
  }, [onEdit])

  if (!preview?.length) {
    return (
      <Card>
        <Banner tone="warning">{t('no-option-groups-were-generated-please-try-a-different-specification')}</Banner>
      </Card>
    )
  }

  const isDisabled = status === 'applying' || status === 'cancelled'

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h3" variant="headingSm">
            {t('generated-option-sets', { count: preview.length })}
          </Text>
          {status === 'applied' && <Badge tone="success">{t('applied')}</Badge>}
          {status === 'cancelled' && <Badge tone="critical">{t('cancelled')}</Badge>}
          {status === 'undone' && <Badge>{t('undone')}</Badge>}
        </InlineStack>

        <div className={styles.OptionGroupList}>
          {preview.map((group, i) => {
            const displayLabel = DISPLAY_STYLE_LABELS[group.displayStyle] || group.displayStyle
            const badgeTone = TYPE_BADGE_TONE[group.optionSetType] || 'info'
            const visibleValues = group.values.slice(0, 5)
            const remainingCount = group.values.length - 5

            return (
              <div key={i} className={styles.OptionGroupItem}>
                <InlineStack gap="200" blockAlign="center" wrap={false}>
                  <Text as="span" variant="bodyMd" fontWeight="semibold">
                    {i + 1}. {group.label}
                  </Text>
                  <Badge tone={badgeTone}>{displayLabel}</Badge>
                </InlineStack>
                <Box paddingInlineStart="400">
                  <Text as="span" variant="bodySm" tone="subdued">
                    {visibleValues.map((v, vi) => {
                      const pricing
                        = v.pricing !== null && v.pricing !== undefined && v.pricing > 0 ? ` (+$${v.pricing})` : ''
                      return (vi > 0 ? ', ' : '') + v.name + pricing
                    })}
                    {remainingCount > 0 && ` +${remainingCount} more`}
                  </Text>
                </Box>
              </div>
            )
          })}
        </div>

        {status === 'error' && <Banner tone="critical">{errorMsg || t('something-went-wrong')}</Banner>}

        {status === 'applying' && <Banner tone="info">{t('creating-layers-and-option-sets-on-your-template')}</Banner>}

        <ButtonGroup>
          {status === 'applied' ? (
            <Button icon={ResetIcon} onClick={handleUndo}>
              {t('undo')}
            </Button>
          ) : (
            <>
              <Button
                variant="primary"
                icon={CheckIcon}
                onClick={handleApply}
                disabled={isDisabled}
                loading={status === 'applying'}
              >
                {t('apply-all')}
              </Button>
              <Button icon={EditIcon} onClick={handleEdit} disabled={isDisabled}>
                {t('edit')}
              </Button>
              <Button icon={XIcon} onClick={handleCancel} disabled={isDisabled} tone="critical">
                {t('cancel')}
              </Button>
            </>
          )}
        </ButtonGroup>
      </BlockStack>
    </Card>
  )
}
