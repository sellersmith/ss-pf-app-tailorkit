/**
 * Hook for client-side template generation logic.
 * Manages template preview generation via Konva, auto-generation on step entry,
 * and template thumbnail URL resolution for the MockupWizard composite canvas.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Banner, BlockStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import { authenticatedFetch } from '~/shopify/fns.client'
import { generateTemplatePreview } from '../utils/generate-template-preview.client'
import { TemplateThumbCard } from '../components/TemplateThumbCard'
import { INSTANT_TEMPLATE_TYPES, PREMADE_TEMPLATES, TEMPLATE_TYPES } from '../constants'
import { SIMPLIFIED_ONBOARDING_EVENTS } from '../tracking-events'
import type {
  ExistingTemplate,
  PerProductState,
  TemplateGenState,
  TemplateType,
  WizardMockupResult,
  WizardAction,
  WizardProduct,
} from '../types'
import styles from '../styles.module.css'

/** Compute normalized (0..1) print-area rect from a mockup result, relative to
 *  processedDimensions. Returns undefined when data is missing or invalid.
 *  The rect is passed to the preview generator so debossed-monogram can sample
 *  the actual personalization area instead of the image center. Normalizing by
 *  processedDimensions makes the rect coord-space-agnostic so it applies
 *  correctly to either the original or the processed image. */
function computeNormalizedPrintAreaRect(
  mockupResult: WizardMockupResult | null | undefined
): { x: number; y: number; width: number; height: number } | undefined {
  const pos = mockupResult?.templatePositions[0]
  const dims = mockupResult?.processedDimensions
  if (!pos || !dims || pos.width <= 0 || pos.height <= 0 || dims.width <= 0 || dims.height <= 0) {
    return undefined
  }
  return {
    x: pos.x / dims.width,
    y: pos.y / dims.height,
    width: pos.width / dims.width,
    height: pos.height / dims.height,
  }
}

interface UseTemplateGenerationOptions {
  currentStep: string
  selectedImageUrl: string | null
  mockupResult: WizardMockupResult | null
  selectedTemplateType: TemplateType | null
  selectedExistingTemplate: ExistingTemplate | null
  templateStates: Record<TemplateType, TemplateGenState>
  dispatch: React.Dispatch<WizardAction>
  /** Bulk mode (multiple products selected) — auto-generates per product */
  isBulkMode?: boolean
  /** All selected products (bulk mode) */
  selectedProducts?: WizardProduct[]
  /** Per-product state (bulk mode) — used to get each product's area dimensions */
  perProductState?: Record<string, PerProductState>
}

export function useTemplateGeneration({
  currentStep,
  selectedImageUrl,
  mockupResult,
  selectedTemplateType,
  selectedExistingTemplate,
  templateStates,
  dispatch,
  isBulkMode = false,
  selectedProducts = [],
  perProductState = {},
}: UseTemplateGenerationOptions) {
  const { t } = useTranslation()
  const { trackEvent } = useEventsTracking()
  const instantGeneratedRef = useRef(false)

  // Fetch existing templates when entering step 4
  const [existingTemplates, setExistingTemplates] = useState<ExistingTemplate[]>([])
  const existingFetchedRef = useRef(false)
  useEffect(() => {
    if (currentStep !== 'templates' || existingFetchedRef.current) return
    existingFetchedRef.current = true
    authenticatedFetch('/api/templates?limit=20&sort=updatedAt&order=desc')
      .then((res: any) => {
        if (res?.items) {
          setExistingTemplates(
            res.items
              .filter((tmpl: any) => tmpl.previewUrl)
              .map((tmpl: any) => ({ id: tmpl._id, name: tmpl.name, previewUrl: tmpl.previewUrl }))
          )
        }
      })
      .catch(() => {})
  }, [currentStep])

  // Pre-made template clone state — tracks which card is currently being cloned
  const [cloningPremadeId, setCloningPremadeId] = useState<string | null>(null)
  const [premadeCloneError, setPremadeCloneError] = useState<string | null>(null)

  // Handle pre-made template click → clone to merchant's shop → select as existing template
  const handlePremadeTemplateClick = useCallback(
    async (premadeId: string) => {
      if (cloningPremadeId) return // Prevent concurrent clone requests
      const premade = PREMADE_TEMPLATES.find(p => p.id === premadeId)
      if (!premade) return
      setCloningPremadeId(premadeId)
      setPremadeCloneError(null)
      try {
        const result = await authenticatedFetch('/api/templates?action=cloneClipartToTemplate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clipartId: premadeId }),
        })
        if (result?.success && result?.data) {
          const clonedTemplate: ExistingTemplate = {
            id: result.data.templateId,
            name: result.data.templateName,
            previewUrl: premade.image,
          }
          dispatch({ type: 'SELECT_EXISTING_TEMPLATE', template: clonedTemplate })
          trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.TEMPLATE_SELECTED, {
            templateType: 'premade',
            premadeTemplateId: premadeId,
          })
        } else {
          setPremadeCloneError(premadeId)
        }
      } catch {
        setPremadeCloneError(premadeId)
      } finally {
        setCloningPremadeId(null)
      }
    },
    [cloningPremadeId, dispatch, trackEvent]
  )

  // Ref to always access latest templateStates inside callbacks (avoids stale closure)
  const templateStatesRef = useRef(templateStates)
  templateStatesRef.current = templateStates

  // Get selection dimensions from mockupResult for template canvas sizing
  const selectionDimensions = useMemo(() => {
    const pos = mockupResult?.templatePositions[0]
    if (pos && pos.width > 0 && pos.height > 0) {
      return { width: Math.round(pos.width), height: Math.round(pos.height) }
    }
    const dims = mockupResult?.processedDimensions
    if (dims && dims.width > 0 && dims.height > 0) {
      return { width: Math.round(dims.width * 0.6), height: Math.round(dims.height * 0.6) }
    }
    return { width: 400, height: 300 }
  }, [mockupResult])

  const printAreaRect = useMemo(() => computeNormalizedPrintAreaRect(mockupResult), [mockupResult])

  const generateTemplate = useCallback(
    async (templateType: TemplateType) => {
      const current = templateStatesRef.current[templateType]
      dispatch({
        type: 'SET_TEMPLATE_STATE',
        templateType,
        state: {
          status: 'generating',
          thumbnailUrl: current?.thumbnailUrl ?? null,
          sourceImageUrl: current?.sourceImageUrl ?? null,
          overlaySvg: current?.overlaySvg ?? null,
          templateId: null,
          error: null,
        },
      })
      try {
        const isAITemplate
          = templateType.includes('initial') || templateType.includes('monogram') || templateType.startsWith('custom-')
        const timeoutMs = isAITemplate ? 120000 : 30000

        // Static import — avoids Vite dynamic chunk loading which fails when dev server URL changes
        const generationPromise = generateTemplatePreview({
          templateType,
          width: selectionDimensions.width,
          height: selectionDimensions.height,
          productImageUrl: selectedImageUrl || undefined,
          printAreaRect,
        })
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Generation timed out')), timeoutMs)
        )
        const result = await Promise.race([generationPromise, timeoutPromise])
        dispatch({
          type: 'SET_TEMPLATE_STATE',
          templateType,
          state: {
            status: 'ready',
            thumbnailUrl: result.thumbnailDataUrl,
            sourceImageUrl: result.sourceImageUrl,
            overlaySvg: result.overlaySvg,
            templateId: null,
            error: null,
          },
        })
        trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.TEMPLATE_GENERATED, { templateType, success: true })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Generation failed'
        console.error(`[useTemplateGeneration] Failed to generate ${templateType}:`, err)
        dispatch({
          type: 'SET_TEMPLATE_STATE',
          templateType,
          state: {
            status: 'error',
            thumbnailUrl: null,
            sourceImageUrl: null,
            overlaySvg: null,
            templateId: null,
            error: errorMessage,
          },
        })
        trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.TEMPLATE_GENERATED, {
          templateType,
          success: false,
          error: errorMessage,
        })
      }
    },
    [selectionDimensions, selectedImageUrl, printAreaRect, trackEvent, dispatch]
  )

  // Auto-generate instant templates when entering step 4.
  // In bulk mode, generate per-product so each product's template matches its area dimensions.
  useEffect(() => {
    if (currentStep !== 'templates' || instantGeneratedRef.current) return
    instantGeneratedRef.current = true

    if (isBulkMode && selectedProducts.length > 1) {
      // Bulk mode: generate plain-custom-text for each product at its own dimensions,
      // then auto-select it. This removes template sharing across products.
      generateTemplatesForAllProducts()
    } else {
      // Single product: generate instant templates for the active product
      for (const type of INSTANT_TEMPLATE_TYPES) {
        if (templateStates[type].status === 'idle') generateTemplate(type)
      }
      if (!selectedTemplateType) {
        dispatch({ type: 'SELECT_TEMPLATE', templateType: 'plain-custom-text' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep])

  /** Bulk mode: generate plain-custom-text for each product using its own area dimensions */
  const generateTemplatesForAllProducts = useCallback(async () => {
    for (const product of selectedProducts) {
      const pps = perProductState[product.id]
      if (!pps?.mockupResult) continue

      // Compute dimensions from this product's area
      const pos = pps.mockupResult.templatePositions[0]
      const dims
        = pos && pos.width > 0 && pos.height > 0
          ? { width: Math.round(pos.width), height: Math.round(pos.height) }
          : { width: 400, height: 300 }

      // Normalized print-area rect for this product (used by debossed templates only —
      // harmless to pass for other types which ignore it)
      const productPrintAreaRect = computeNormalizedPrintAreaRect(pps.mockupResult)

      try {
        const result = await generateTemplatePreview({
          templateType: 'plain-custom-text',
          width: dims.width,
          height: dims.height,
          productImageUrl: pps.selectedImageUrl || undefined,
          printAreaRect: productPrintAreaRect,
        })

        // Write generated template + auto-select directly into this product's perProductState
        const currentPps = perProductState[product.id]
        if (!currentPps) continue
        dispatch({
          type: 'UPDATE_PRODUCT_STATE',
          productId: product.id,
          state: {
            selectedTemplateType: 'plain-custom-text',
            templateStates: {
              ...currentPps.templateStates,
              'plain-custom-text': {
                status: 'ready',
                thumbnailUrl: result.thumbnailDataUrl,
                sourceImageUrl: result.sourceImageUrl,
                overlaySvg: result.overlaySvg,
                templateId: null,
                error: null,
              },
            },
          },
        })
      } catch (err) {
        console.error(`[useTemplateGeneration] Failed to generate for product ${product.id}:`, err)
      }
    }

    // Also generate for active product via normal flow (updates shared state for UI)
    for (const type of INSTANT_TEMPLATE_TYPES) {
      if (templateStates[type].status === 'idle') generateTemplate(type)
    }
    if (!selectedTemplateType) {
      dispatch({ type: 'SELECT_TEMPLATE', templateType: 'plain-custom-text' })
    }
  }, [selectedProducts, perProductState, templateStates, selectedTemplateType, generateTemplate, dispatch])

  // Scroll to top of page so the mockup preview is visible
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Handle template thumb click — select and generate if needed
  const handleThumbClick = useCallback(
    (type: TemplateType) => {
      const tState = templateStates[type]
      if (tState.status === 'idle' || tState.status === 'error') generateTemplate(type)
      const fromType = selectedTemplateType
      dispatch({ type: 'SELECT_TEMPLATE', templateType: type })
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.TEMPLATE_SELECTED, {
        templateType: type,
        fromTemplateType: fromType,
      })
      // Instant templates: scroll immediately since preview is ready
      if (tState.status === 'ready') scrollToTop()
    },
    [templateStates, selectedTemplateType, generateTemplate, trackEvent, dispatch, scrollToTop]
  )

  // AI templates: scroll to top when generation completes
  const prevSelectedStatusRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedTemplateType) return
    const currentStatus = templateStates[selectedTemplateType]?.status
    const prevStatus = prevSelectedStatusRef.current
    prevSelectedStatusRef.current = currentStatus ?? null
    if (prevStatus === 'generating' && currentStatus === 'ready') {
      scrollToTop()
    }
  }, [selectedTemplateType, templateStates, scrollToTop])

  // Template image URLs for MockupWizard's composite canvas
  const lastTemplateUrlRef = useRef<string[]>([])
  const currentTemplateImageUrls = useMemo(() => {
    // Existing template selected — use its preview URL
    if (selectedExistingTemplate?.previewUrl) {
      lastTemplateUrlRef.current = [selectedExistingTemplate.previewUrl]
      return lastTemplateUrlRef.current
    }
    // AI-generated template selected
    if (!selectedTemplateType) return lastTemplateUrlRef.current
    const templateState = templateStates[selectedTemplateType]
    if (templateState?.thumbnailUrl) {
      lastTemplateUrlRef.current = [templateState.thumbnailUrl]
      return lastTemplateUrlRef.current
    }
    return lastTemplateUrlRef.current
  }, [selectedExistingTemplate, selectedTemplateType, templateStates])

  // Handle existing template selection
  const handleExistingTemplateClick = useCallback(
    (template: ExistingTemplate) => {
      dispatch({ type: 'SELECT_EXISTING_TEMPLATE', template })
      trackEvent(SIMPLIFIED_ONBOARDING_EVENTS.TEMPLATE_SELECTED, {
        templateType: 'existing',
        existingTemplateId: template.id,
      })
    },
    [dispatch, trackEvent]
  )

  // Template list content for MockupWizard's resultSideContent
  const templateListContent = useMemo(
    () => (
      <BlockStack gap="400">
        <Banner tone="info">
          <Text as="p">
            {t(
              selectedTemplateType && selectedTemplateType.includes('text')
                ? 'storefront-preview-hint-text'
                : 'storefront-preview-hint-image'
            )}
          </Text>
        </Banner>

        {/* Your templates section — always shown */}
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            {t('your-templates')}
          </Text>
          {existingTemplates.length > 0 ? (
            existingTemplates.map(tmpl => (
              <div
                key={tmpl.id}
                className={[styles.thumbCard, selectedExistingTemplate?.id === tmpl.id && styles.thumbCardSelected]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleExistingTemplateClick(tmpl)}
                role="radio"
                aria-checked={selectedExistingTemplate?.id === tmpl.id}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleExistingTemplateClick(tmpl)
                  }
                }}
              >
                <img
                  src={tmpl.previewUrl}
                  alt={tmpl.name}
                  style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                />
                <Text as="span" variant="bodyMd">
                  {tmpl.name}
                </Text>
              </div>
            ))
          ) : (
            <Text as="p" variant="bodySm" tone="subdued">
              {t('your-saved-templates-will-appear-here')}
            </Text>
          )}
        </BlockStack>

        {/* Ready-made templates — curated starting points, cloned on click */}
        <BlockStack gap="200">
          <Text as="h3" variant="headingSm">
            {t('ready-made-templates')}
          </Text>
          {PREMADE_TEMPLATES.map(premade => (
            <div
              key={premade.id}
              className={[
                styles.thumbCard,
                selectedExistingTemplate?.previewUrl === premade.image && styles.thumbCardSelected,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handlePremadeTemplateClick(premade.id)}
              role="radio"
              aria-checked={selectedExistingTemplate?.previewUrl === premade.image}
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handlePremadeTemplateClick(premade.id)
                }
              }}
            >
              {cloningPremadeId === premade.id ? (
                <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className={styles.thumbSpinner} />
                </div>
              ) : (
                <img
                  src={premade.image}
                  alt={premade.label}
                  style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
                />
              )}
              <Text as="span" variant="bodyMd">
                {t(premade.label)}
              </Text>
              {premadeCloneError === premade.id && (
                <Text as="span" variant="bodySm" tone="critical">
                  {t('failed-to-load-template')}
                </Text>
              )}
            </div>
          ))}
        </BlockStack>

        {/* AI-generated templates section */}
        <Text as="h3" variant="headingSm">
          {t('ai-generated-templates')}
        </Text>
        {TEMPLATE_TYPES.map(config => (
          <TemplateThumbCard
            key={config.type}
            type={config.type}
            label={config.label}
            state={templateStates[config.type]}
            isSelected={selectedTemplateType === config.type}
            isInstant={config.isInstant}
            onClick={() => handleThumbClick(config.type)}
            onRegenerate={
              !config.isInstant
                ? () => {
                    generateTemplate(config.type)
                    dispatch({ type: 'SELECT_TEMPLATE', templateType: config.type })
                  }
                : undefined
            }
          />
        ))}
      </BlockStack>
    ),
    [
      t,
      templateStates,
      selectedTemplateType,
      selectedExistingTemplate,
      existingTemplates,
      cloningPremadeId,
      premadeCloneError,
      handleThumbClick,
      handleExistingTemplateClick,
      handlePremadeTemplateClick,
      generateTemplate,
      dispatch,
    ]
  )

  return {
    generateTemplate,
    handleThumbClick,
    currentTemplateImageUrls,
    templateListContent,
  }
}
