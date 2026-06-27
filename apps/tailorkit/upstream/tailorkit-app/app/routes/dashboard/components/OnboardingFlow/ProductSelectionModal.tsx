import { useCallback } from 'react'
import ProductSelector from '~/modules/ProductSelector'
import { TemplatesService } from '~/api/services/templates'
import { buildPrebuiltPrintAreas } from '~/modules/ProductEditor/utilities/prebuiltPrintAreas'
import useInitIntegration from '~/modules/ProductEditor/hooks/useInitIntegration'
import { duplicateClipartTemplate } from '~/utils/integration/templateDuplication'
import { uuid } from '~/utils/uuid'
import type { IProduct, IVariant } from '~/types/shopify-product'
import type { Template } from '~/types/psd'
import { CATEGORIES } from './constants'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'

interface ProductSelectionModalProps {
  open: boolean
  selectedCategory: string | null
  onClose: () => void
  onCreating: (creating: boolean) => void
}

export function ProductSelectionModal({ open, selectedCategory, onClose, onCreating }: ProductSelectionModalProps) {
  const navigate = useNavigateAppBridge()
  const { prepareVariantsSelected } = useInitIntegration()
  const category = CATEGORIES.find(c => c.id === selectedCategory)
  const premadeTemplateId = category?.premadeTemplateId || ''

  const handleSelect = useCallback(
    async (_products: IProduct[], variants: IVariant[]) => {
      onCreating(true)
      try {
        let templatePayload: Template | undefined

        // Clone premade template if category has one (skip for "Create your template")
        if (premadeTemplateId) {
          try {
            const cloneResult = await duplicateClipartTemplate(premadeTemplateId)
            if (cloneResult?.success && cloneResult?.data?.templateId) {
              templatePayload = await TemplatesService.getByIds([cloneResult.data.templateId]).then(arr => arr?.[0])
            }
          } catch (error) {
            console.error('[OnboardingFlow] Failed to clone premade template:', error)
          }
        }

        const integrationId = uuid()
        const { prebuiltPrintAreasByVariantId, selectedPrintAreaId } = buildPrebuiltPrintAreas(variants)

        const integrationUrl = await prepareVariantsSelected({
          variants,
          integrationId,
          template: templatePayload,
          prebuiltPrintAreasByVariantId,
          selectedPrintAreaId,
        })

        // Ensure IDB transaction is fully committed
        await new Promise(resolve => setTimeout(resolve, 100))

        // Append onboarding=true to the editor URL
        const separator = integrationUrl.includes('?') ? '&' : '?'
        navigate(`${integrationUrl}${separator}onboarding=true`)
      } catch (error) {
        console.error('[OnboardingFlow] Failed to create integration:', error)
        onCreating(false)
      }
    },
    [premadeTemplateId, navigate, prepareVariantsSelected, onCreating]
  )

  return <ProductSelector open={open} onClose={onClose} onSelect={handleSelect} />
}
