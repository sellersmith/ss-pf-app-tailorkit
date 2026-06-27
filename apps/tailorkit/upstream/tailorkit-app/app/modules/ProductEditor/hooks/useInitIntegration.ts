import { useParams } from '@remix-run/react'
import { useCallback, useState } from 'react'
import { DEFAULT_INTEGRATION_STORE, IntegrationStore } from '~/stores/modules/integration/integration'
import type { Integration as TIntegration, PrintArea } from '~/types/integration'
import { uuid } from '~/utils/uuid'
import { generateIntegrationEditorUrl } from '../constants'
import { getVariantsSelectedWithNewMockup } from '../utilities/evaluateMetafieldLayersAndPrintAreas'
import { deleteFileFromIDB, openIDBDatabase, storeJSONFileToIDB } from '~/bootstrap/db/index-db'
import { IDB_STORE_NAME, IDB_DATABASE_NAME } from '~/constants/index-db'
import type { IVariant } from '~/types/shopify-product'
import { useEditorParams, getEditorParamsStore } from './useEditorParams'
import { getTemplateId, createDefaultTemplate } from '../utilities/templateHelpers'
import { updateUrlParamsIfNeeded } from '../utilities/integrationHelpers'
import {
  getAllVariantsIntegrated,
  getVariantsSelected,
  getTemplateSelected,
  getTemporaryIntegration,
} from '../utilities/integrationData'
import { fetchVariantsWithProductData, formatVariant } from '../utilities/variantProcessing'
import {
  prepareTemplateForNewIntegration,
  createTemplateForPrintAreaFactory,
  markDefaultTemplatesAsEdited,
  getFinalPrintAreaId,
} from '../utilities/newIntegrationHelpers'
import { shopifyGlobal } from '~/constants/shopify'

// Track initialized integration IDs to prevent duplicate initialization
const initializedIntegrationIds = new Set<string>()

const useInitIntegration = () => {
  const {
    mockupId: mockupIdFromParams,
    printAreaId: printAreaIdFromParams,
    templateId: templateIdFromParams,
  } = useEditorParams()

  const params = useParams()
  const [loading, setLoading] = useState(true)

  /**
   * Prepare variants selected for integration
   */
  const prepareVariantsSelected = useCallback(
    async (args: {
      variants: IVariant[]
      integrationId: string
      returnUrl?: string
      template?: any
      prebuiltPrintAreasByVariantId?: Record<string, PrintArea[]>
      selectedPrintAreaId?: string
      mockupId?: string
    }) => {
      const {
        variants,
        integrationId,
        returnUrl,
        template: initialTemplate,
        prebuiltPrintAreasByVariantId,
        selectedPrintAreaId,
        mockupId: providedMockupId,
      } = args

      const firstVariant = variants?.[0]

      // Extract mockupId from returnUrl if provided, otherwise generate new one
      let mockupId = providedMockupId
      if (!mockupId && returnUrl) {
        try {
          const url = new URL(returnUrl, window.location.origin)
          mockupId = url.searchParams.get('mockup') || undefined
        } catch (error) {
          // If URL parsing fails, generate new mockupId
        }
      }
      if (!mockupId) {
        mockupId = uuid()
      }

      // Get printAreaId from prebuilt if available
      let printAreaIdFromPrebuilt: string | undefined
      if (prebuiltPrintAreasByVariantId && Object.keys(prebuiltPrintAreasByVariantId).length > 0) {
        const firstVariantId = variants?.[0]?.id
        const firstPrebuilt = firstVariantId ? prebuiltPrintAreasByVariantId[firstVariantId]?.[0] : undefined
        printAreaIdFromPrebuilt = selectedPrintAreaId || firstPrebuilt?._id
      }

      const shopDomain = shopifyGlobal?.config?.shop || ''

      // Determine if we should add default text layer (only for new templates, not existing ones)
      // Add text layer if:
      // 1. No initial template provided (creating new template)
      // 2. We have a selected print area ID (first print area to be opened)
      // 3. We have shopDomain
      const shouldAddDefaultTextLayer = !initialTemplate && !!printAreaIdFromPrebuilt && !!shopDomain

      // CRITICAL: Template creation logic for dashboard flow:
      // ONLY create a template if:
      // 1. initialTemplate is provided (template selected from library)
      // 2. OR prebuiltPrintAreasByVariantId has dimensions (metafields already parsed)
      //
      // Why not create template with DEFAULT dimensions?
      // - This flow runs BEFORE metafield parsing for POD products
      // - Creating template with DEFAULT (500x500) would be stored to IndexedDB
      // - Editor would then load this wrong template instead of creating correct one
      // - Better to NOT create template here and let editor flow create it with correct dimensions

      let template = initialTemplate

      // Only create default template if we have print area dimensions (metafields parsed)
      if (!template && prebuiltPrintAreasByVariantId && Object.keys(prebuiltPrintAreasByVariantId).length > 0) {
        const firstVariantId = variants?.[0]?.id
        const firstPrintArea = firstVariantId ? prebuiltPrintAreasByVariantId[firstVariantId]?.[0] : undefined

        // Create template ONLY if print area has dimensions (POD products with parsed metafields)
        if (firstPrintArea?.width && firstPrintArea?.height) {
          template = createDefaultTemplate(
            firstVariant,
            {
              width: firstPrintArea.width,
              height: firstPrintArea.height,
            },
            [],
            firstVariant?.product?.featuredImage,
            shouldAddDefaultTextLayer,
            shopDomain
          )
        }
        // If no dimensions, leave template as null/undefined
        // Editor will create new template with correct dimensions from metafields
      }

      // Ensure template has _id (only if template was created)
      if (template && !template._id) {
        template._id = uuid()
      }

      // Use returnUrl if provided, otherwise generate new URL
      const integrationUrl
        = returnUrl
        || generateIntegrationEditorUrl({
          integrationId,
          mockupId,
          ...(printAreaIdFromPrebuilt ? { printAreaId: printAreaIdFromPrebuilt } : {}),
          ...(template?._id ? { templateId: template._id } : {}),
        })

      try {
        // Store variants and template in parallel
        const [variantsDb, templateDb] = await Promise.all([
          openIDBDatabase(IDB_DATABASE_NAME.VARIANTS_SELECTED, IDB_STORE_NAME.INTEGRATION),
          template ? openIDBDatabase(IDB_DATABASE_NAME.TEMPLATE_SELECTED, IDB_STORE_NAME.INTEGRATION) : null,
        ])

        await storeJSONFileToIDB(
          variantsDb,
          IDB_STORE_NAME.INTEGRATION,
          { variants, prebuiltPrintAreasByVariantId },
          integrationId
        )

        if (template && templateDb) {
          await storeJSONFileToIDB(templateDb, IDB_STORE_NAME.INTEGRATION, { template }, integrationId)
        }

        return returnUrl || integrationUrl
      } catch (error) {
        console.error('[useInitIntegration] Error storing integration:', error)
        return returnUrl || integrationUrl
      }
    },
    []
  )

  /**
   * Handle existing integration initialization
   */
  const handleExistingIntegration = useCallback(
    async (integration: TIntegration, options: any, allVariantsIntegrated: any[], isTemporaryIntegration: boolean) => {
      const currentVariants = integration.variants
      const variantIds: string[] = currentVariants.map(v => v.id)

      // Fetch variants data
      const { variants: variantsWithProductData, fallbackProduct } = await fetchVariantsWithProductData(
        variantIds,
        currentVariants
      )

      // Determine selected print area ID (from URL params or first print area)
      const firstVariant = currentVariants?.[0]
      const firstPrintAreaFromVariant = firstVariant?.printAreas?.[0]
      const selectedPrintAreaId = printAreaIdFromParams || firstPrintAreaFromVariant?._id || ''

      const shopDomain = shopifyGlobal?.config?.shop || ''

      // Format variants with layers and templates
      const formattedVariants = await Promise.all(
        currentVariants.map(async (variant: any) => {
          const shopifyVariant = variantsWithProductData.find((v: any) => v.id === variant.id)
          const actualProduct = shopifyVariant?.product || variant.product || fallbackProduct

          return formatVariant(
            variant,
            shopifyVariant,
            actualProduct,
            options?.setValidationErrors,
            selectedPrintAreaId,
            shopDomain
          )
        })
      )

      // Update URL params
      const firstFormattedVariant = formattedVariants?.[0]
      const firstPrintArea = firstFormattedVariant?.printAreas?.[0]
      const finalPrintAreaId = printAreaIdFromParams || firstPrintArea?._id || ''
      const finalTemplateId = templateIdFromParams || getTemplateId(firstPrintArea?.template) || ''

      updateUrlParamsIfNeeded(finalPrintAreaId, finalTemplateId)

      IntegrationStore.dispatch({
        type: 'INIT_DATA',
        payload: {
          state: {
            ...integration,
            variants: formattedVariants,
            allVariantsIntegrated: [...allVariantsIntegrated],
          },
        },
        skipTrace: !isTemporaryIntegration,
      })
    },
    [printAreaIdFromParams, templateIdFromParams]
  )

  /**
   * Handle new integration initialization
   */
  const handleNewIntegration = useCallback(
    async (
      integrationId: string,
      mockupIdFromParams: string | undefined,
      printAreaIdFromParams: string,
      templateIdFromParams: string,
      allVariantsIntegrated: any[]
    ) => {
      const mockupIdFromSearchParams = mockupIdFromParams || uuid()
      const printAreaIdFromSearchParams = printAreaIdFromParams || uuid()

      // Fetch variants and template in parallel
      const [{ variantsSelected, prebuiltPrintAreasByVariantId }, templateData] = await Promise.all([
        getVariantsSelected(integrationId),
        getTemplateSelected(integrationId),
      ])

      const firstVariantFromSelected = variantsSelected[0]

      // Prepare template
      const { template: templateSelected, templateDimPx } = prepareTemplateForNewIntegration(
        templateData,
        firstVariantFromSelected,
        templateIdFromParams
      )

      const shopDomain = shopifyGlobal?.config?.shop || ''

      // Create template factory function
      const createTemplateForPrintAreaFn = createTemplateForPrintAreaFactory({
        templateSelected,
        templateData,
        printAreaIdFromSearchParams,
        prebuiltPrintAreasByVariantId,
        mockupIdFromSearchParams, // Pass mockupId to ensure we only preserve templates from same mockup
        selectedPrintAreaId: printAreaIdFromSearchParams, // print area that will be opened first
        shopDomain,
      })

      // Get variants with mockup
      const variantsSelectedWithMockup = await getVariantsSelectedWithNewMockup({
        variantsSelected,
        mockupIdFromSearchParams,
        seedTemplateDimensionPx: templateDimPx || undefined,
        prebuiltPrintAreasByVariantId,
        createTemplateForPrintArea: createTemplateForPrintAreaFn,
        selectedPrintAreaId: printAreaIdFromSearchParams,
        shopDomain,
      })

      // Mark all default templates as edited
      markDefaultTemplatesAsEdited(variantsSelectedWithMockup)

      // Update URL params
      const { printAreaId: finalPrintAreaId, templateId: finalTemplateId } = getFinalPrintAreaId(
        variantsSelectedWithMockup,
        printAreaIdFromSearchParams
      )

      // Sync mockupId to URL if it was generated (not from params)
      updateUrlParamsIfNeeded(finalPrintAreaId, finalTemplateId, mockupIdFromSearchParams)

      IntegrationStore.dispatch({
        type: 'INIT_DATA',
        payload: {
          state: {
            ...DEFAULT_INTEGRATION_STORE,
            _id: integrationId,
            variants: variantsSelectedWithMockup,
            allVariantsIntegrated: [...allVariantsIntegrated, ...variantsSelectedWithMockup],
          },
        },
      })
      setLoading(false)
    },
    []
  )

  const initIntegration = useCallback(
    async (
      integration: TIntegration,
      options?: {
        setValidationErrors?: (id: string, dataKey: string, error: Error | string | null) => void
        [key: string]: any
        /** Skip skeleton if data already prepared by loading shell */
        prepared?: boolean
      }
    ) => {
      setLoading(!options?.prepared)

      try {
        const allVariantsIntegrated = await getAllVariantsIntegrated()

        // Read current editor params from store at call time to get fresh values
        // This ensures we use the latest printAreaId/templateId without triggering re-init
        const store = getEditorParamsStore()
        const editorParamsState = store.getState()
        const currentMockupIdFromParams = editorParamsState.mockupId
        const currentPrintAreaIdFromParams = editorParamsState.printAreaId
        const currentTemplateIdFromParams = editorParamsState.templateId

        // Check for temporary integration
        const mockupId = currentMockupIdFromParams || ''
        const temporaryIntegration = await getTemporaryIntegration(mockupId)
        if (temporaryIntegration) {
          integration = temporaryIntegration as TIntegration
          const db = await openIDBDatabase(IDB_DATABASE_NAME.INTEGRATION, IDB_STORE_NAME.INTEGRATION_TEMPORARY)
          await deleteFileFromIDB(db, IDB_STORE_NAME.INTEGRATION_TEMPORARY, mockupId)
        }

        if (integration) {
          await handleExistingIntegration(integration, options, allVariantsIntegrated, !!temporaryIntegration)
          setLoading(false)
          return
        }

        const integrationId = params.id || ''

        // Prevent duplicate initialization - check with integrationId + mockupId combination
        // This allows re-initialization if mockupId changes in URL
        // NOTE: printAreaId and templateId changes should NOT trigger re-initialization
        const initKey = `${integrationId}:${mockupId}`
        if (initializedIntegrationIds.has(initKey)) {
          setLoading(false)
          return
        }

        // Mark as initialized before calling handleNewIntegration
        initializedIntegrationIds.add(initKey)

        await handleNewIntegration(
          integrationId,
          currentMockupIdFromParams,
          currentPrintAreaIdFromParams,
          currentTemplateIdFromParams,
          allVariantsIntegrated
        )
      } catch (error) {
        console.error('[useInitIntegration] Error:', error)
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      handleExistingIntegration,
      handleNewIntegration,
      mockupIdFromParams, // Keep mockupId to trigger re-init when mockupId changes (intentional)
      params.id,
      // NOTE: printAreaIdFromParams and templateIdFromParams are NOT in dependencies
      // because they should NOT trigger re-initialization when switching print areas.
      // They are read fresh from getEditorParamsStore().getState() at call time.
    ]
  )

  return { initIntegration, prepareVariantsSelected, loading }
}

export default useInitIntegration
