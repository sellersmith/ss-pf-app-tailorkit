import { BlockStack, Box, Button, Divider, Icon, InlineStack, Text, Tooltip } from '@shopify/polaris'
import { AlertCircleIcon, InfoIcon, ListNumberedIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import type { WizardConfig, WizardStep } from '~/types/wizard'
import type { PrintArea } from '~/types/integration'
import type { CollectorLayer } from '~/shared/customization-items'
import { collectCustomizationItems } from '~/shared/customization-items'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import WizardStepList from './WizardStepList'

interface WizardSettingsProps {
  printAreas: PrintArea[]
  layers: CollectorLayer[]
  wizardConfig: WizardConfig | null
  onChange: (config: WizardConfig | null) => void
}

export default function WizardSettings({ printAreas, layers, wizardConfig, onChange }: WizardSettingsProps) {
  const { t } = useTranslation()
  const tracking = useFeatureTracking('wizard_mode')

  const isEnabled = wizardConfig?.enabled ?? false

  // Check if all customization items are assigned to a step
  const hasUnassigned = useMemo(() => {
    if (!isEnabled || !wizardConfig?.steps?.length) return false
    const allItems = collectCustomizationItems(layers)
    const assignedIds = new Set(wizardConfig.steps.flatMap(s => s.items.map(i => i.itemId)))
    return allItems.some(item => !assignedIds.has(item.id))
  }, [isEnabled, wizardConfig?.steps, layers])

  function handleToggle(): void {
    if (isEnabled) {
      if (wizardConfig?.steps?.length && !window.confirm(t('this-will-remove-all-configured-steps-continue'))) return
      tracking.trackAction('disabled')
      onChange(null)
    } else {
      tracking.trackStarted()
      onChange({ enabled: true, steps: [] })
    }
  }

  function handleReorder(steps: WizardStep[]): void {
    if (!wizardConfig) return
    onChange({ ...wizardConfig, steps })
  }

  function handleStepUpdate(stepId: string, updates: Partial<WizardStep>): void {
    if (!wizardConfig) return
    onChange({ ...wizardConfig, steps: wizardConfig.steps.map(s => (s.id === stepId ? { ...s, ...updates } : s)) })
  }

  function handleStepRemove(stepId: string): void {
    if (!wizardConfig) return
    onChange({ ...wizardConfig, steps: wizardConfig.steps.filter(s => s.id !== stepId) })
  }

  function handleAddStep(step: WizardStep): void {
    if (!wizardConfig) return
    onChange({ ...wizardConfig, steps: [...wizardConfig.steps, step] })
  }

  return (
    <BlockStack gap="300">
      {/* Header with icon + toggle button */}
      <InlineStack gap="200" blockAlign="start" wrap={false}>
        <Box>
          <Icon source={hasUnassigned ? AlertCircleIcon : ListNumberedIcon} tone={hasUnassigned ? 'warning' : 'base'} />
        </Box>
        <BlockStack gap="100">
          <InlineStack gap="100" blockAlign="center" wrap={false}>
            <Text as="h3" variant="bodyMd" fontWeight="semibold">
              {t('step-by-step-mode')}
            </Text>
            <Tooltip
              content={t(
                'break-product-customization-into-guided-steps-assign-customization-items-to-each-step-to-control-what-customers-see'
              )}
            >
              <Icon source={InfoIcon} tone="subdued" />
            </Tooltip>
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">
            {t('customers-see-one-step-at-a-time-instead-of-all-options-at-once')}
          </Text>
        </BlockStack>
      </InlineStack>

      <Button variant={isEnabled ? 'primary' : 'secondary'} onClick={handleToggle} fullWidth>
        {isEnabled ? t('disable-steps') : t('enable-steps')}
      </Button>

      {isEnabled && wizardConfig && (
        <>
          <Divider />
          <WizardStepList
            steps={wizardConfig.steps}
            layers={layers}
            printAreas={printAreas}
            onReorder={handleReorder}
            onStepUpdate={handleStepUpdate}
            onStepRemove={handleStepRemove}
            onAddStep={handleAddStep}
          />
        </>
      )}
    </BlockStack>
  )
}
