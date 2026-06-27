import { Box } from '@shopify/polaris'
import { useCallback } from 'react'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { getAllLayerStore } from '~/stores/modules/layer'
import { TemplateEditorStore } from '~/stores/modules/template'
import WizardSettings from '~/modules/TemplateEditor/components/WizardSettings'
import type { WizardConfig } from '~/types/wizard'
import type { PrintArea } from '~/types/integration'
import type { CollectorLayer } from '~/shared/customization-items/collector'

/**
 * StorefrontToolPanel — configures storefront buyer experience.
 * Currently contains "Steps" feature for step-by-step personalization.
 * Designed to hold more storefront features in the future.
 */
export default function StorefrontToolPanel() {
  const wizardConfig = useStore(TemplateEditorStore, state => state.wizardConfig ?? null)
  const printAreas = useStore(IntegrationStore, state => (state.variants?.[0]?.printAreas || []) as PrintArea[])

  // Read layer state fresh each render so the list stays in sync when layers
  // are added/removed. Filter out soft-deleted layers (isDeletedOnEditor) so
  // the wizard only shows items that still exist on the canvas.
  const layers = getAllLayerStore()
    .map(store => store.getState())
    .filter(layer => !layer.isDeletedOnEditor) as CollectorLayer[]

  const handleWizardConfigChange = useCallback((config: WizardConfig | null) => {
    TemplateEditorStore.dispatch({
      type: 'INIT_DATA',
      payload: { state: { wizardConfig: config } },
    })
  }, [])

  return (
    <Box padding="300" paddingBlockStart="200">
      <WizardSettings
        printAreas={printAreas}
        layers={layers}
        wizardConfig={wizardConfig}
        onChange={handleWizardConfigChange}
      />
    </Box>
  )
}
