import { useFetcher } from '@remix-run/react'
import { Badge, Banner, BlockStack, Box, Grid, Page } from '@shopify/polaris'
import isEqual from 'lodash/isEqual'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ETriggerProductsType } from '~/enums/checkbox'
import type { EPlacementType } from '~/enums/checkbox'
import { MODAL_ID } from '~/constants/modal'
import { useModal } from '~/utils/hooks/useModal'
import type {
  CheckboxContent,
  CheckboxWithFullData,
  Popup,
  UpsellProduct,
  ProductData,
  VariantData,
} from '~/types/checkbox'
import { showToast } from '~/utils/toastEvents'
import ContextualSaveBar from '~/components/ContextualSaveBar'
import ProductSelector from '~/modules/ProductSelector'
import CheckboxPreview from './CheckboxPreview'
import DisplayContentCard from './DisplayContentCard'
import PlacementCard from './PlacementCard'
import PopupSettingsCard from './PopupSettingsCard'
import TriggerProductsCard from './TriggerProductsCard'
import {
  type CheckboxFormState,
  type CheckboxValidationError,
  DEFAULT_FORM_STATE,
  checkboxToFormState,
  formStateToCheckboxData,
  validateFormState,
} from './types'
import UpsellProductCard from './UpsellProductCard'
import WidgetConfigCard from './WidgetConfigCard'
import InstallCheckboxModal from './InstallCheckboxModal'
import EnableThemeHelperBanner from '~/components/banners/EnableThemeHelperBanner'
import type { CheckboxGlobalStyling } from '~/types/global-styling'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import { TOAST } from '~/constants/toasts'
import { NavMenuItems } from '~/bootstrap/app-config'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'

// Types for selected product/variant data (re-use from add-on types)
type SelectedProduct = ProductData

type SelectedVariantData = VariantData & {
  product: VariantData['product'] & {
    hasOnlyDefaultVariant?: boolean
    variants?: Array<{ id: string; title: string; price?: string }>
  }
}

// Type for selected trigger variants (used when triggerProductsType is SPECIFIC_VARIANTS)
type SelectedTriggerVariant = VariantData

interface CheckboxFormProps {
  mode: 'add' | 'edit'
  checkbox?: CheckboxWithFullData
  // Data for trigger product selection
  collections?: Array<{ id: string; title: string }>
  tags?: string[]
  vendors?: string[]
  productTypes?: string[]
  // Global add-on styling for preview
  checkboxStyling?: CheckboxGlobalStyling
  // App config for installation guide and theme helper (loaded lazily)
  appConfig?: {
    isOS2Theme?: boolean
    checkboxBlockLinkProduct?: string
    checkboxBlockLinkCart?: string
    enabledOneTickHelper?: boolean
    oneTickHelperLink?: string
  }
  // Whether appConfig is still being loaded
  isLoadingAppConfig?: boolean
  // Callback to refresh app config and return whether helper is enabled
  onRefreshAppConfig?: () => Promise<boolean>
  // Upsell product limit from plan (number = limited, null/undefined = unlimited)
  upsellProductLimit?: number | null
  // Whether the selected upsell product has a TailorKit integration (from loader)
  isUpsellProductIntegrated?: boolean
}

/**
 * Extract initial selected products data from add-on
 * Similar to OneTick's pattern where the add-on contains full product/variant objects
 */
function getInitialSelectedProductsData(checkbox?: CheckboxWithFullData): SelectedProduct[] {
  if (!checkbox?.targetProductsData) return []
  if (checkbox.triggerProductsType !== ETriggerProductsType.SPECIFIC_PRODUCTS) return []

  // targetProductsData is ProductData[] when SPECIFIC_PRODUCTS
  return checkbox.targetProductsData as ProductData[]
}

/**
 * Extract initial selected trigger variants data from add-on
 */
function getInitialSelectedTriggerVariantsData(checkbox?: CheckboxWithFullData): SelectedTriggerVariant[] {
  if (!checkbox?.targetProductsData) return []
  if (checkbox.triggerProductsType !== ETriggerProductsType.SPECIFIC_VARIANTS) return []

  // targetProductsData is VariantData[] when SPECIFIC_VARIANTS
  return checkbox.targetProductsData as VariantData[]
}

/**
 * Extract initial selected upsell variant data from add-on
 */
function getInitialSelectedVariantData(checkbox?: CheckboxWithFullData): SelectedVariantData | null {
  if (!checkbox?.upsellProductsData?.length) return null
  return checkbox.upsellProductsData[0] as SelectedVariantData
}

function getInitialSelectedExcludeProductsData(checkbox?: CheckboxWithFullData): SelectedProduct[] {
  if (!checkbox?.excludeTriggerProductsData) return []
  if (checkbox.excludeTriggerProductsType !== ETriggerProductsType.SPECIFIC_PRODUCTS) return []

  return checkbox.excludeTriggerProductsData as ProductData[]
}

function getInitialSelectedExcludeVariantsData(checkbox?: CheckboxWithFullData): SelectedTriggerVariant[] {
  if (!checkbox?.excludeTriggerProductsData) return []
  if (checkbox.excludeTriggerProductsType !== ETriggerProductsType.SPECIFIC_VARIANTS) return []

  return checkbox.excludeTriggerProductsData as VariantData[]
}

export default function CheckboxForm({
  mode,
  checkbox,
  collections = [],
  tags = [],
  vendors = [],
  productTypes = [],
  checkboxStyling,
  appConfig,
  isLoadingAppConfig = false,
  onRefreshAppConfig,
  upsellProductLimit,
  isUpsellProductIntegrated: initialIsUpsellProductIntegrated = false,
}: CheckboxFormProps) {
  const { t } = useTranslation()
  const navigate = useNavigateAppBridge()
  const saveFetcher = useFetcher<{ success: boolean; message?: string }>()
  const { openModal, closeModal } = useModal()
  const { trackAction } = useFeatureTracking('cross_product_personalizer')
  const checkboxTracking = useFeatureTracking('checkbox_conditions')

  // Determine if "All products" trigger option should be hidden (limited plans)
  const hideAllProductsOption = typeof upsellProductLimit === 'number'

  // Initialize form state — override default trigger type for limited plans
  const initialState = useMemo(() => {
    const state = checkbox ? checkboxToFormState(checkbox) : DEFAULT_FORM_STATE
    if (hideAllProductsOption && state.triggerProductsType === ETriggerProductsType.ALL_PRODUCTS) {
      return { ...state, triggerProductsType: ETriggerProductsType.SPECIFIC_PRODUCTS, targetProducts: [] }
    }
    return state
  }, [checkbox, hideAllProductsOption])

  // Extract initial product/variant data from add-on (similar to OneTick's pattern)
  const initialSelectedProductsData = useMemo(() => getInitialSelectedProductsData(checkbox), [checkbox])
  const initialSelectedTriggerVariantsData = useMemo(() => getInitialSelectedTriggerVariantsData(checkbox), [checkbox])
  const initialSelectedVariantData = useMemo(() => getInitialSelectedVariantData(checkbox), [checkbox])
  const initialSelectedExcludeProductsData = useMemo(() => getInitialSelectedExcludeProductsData(checkbox), [checkbox])
  const initialSelectedExcludeVariantsData = useMemo(() => getInitialSelectedExcludeVariantsData(checkbox), [checkbox])

  const [formState, setFormState] = useState<CheckboxFormState>(initialState)
  const [isSaving, setIsSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<CheckboxValidationError[]>([])

  // Product selector state
  const [showTriggerProductSelector, setShowTriggerProductSelector] = useState(false)
  const [showTriggerVariantSelector, setShowTriggerVariantSelector] = useState(false)
  const [showAddonProductSelector, setShowAddonProductSelector] = useState(false)
  const [showExcludeProductSelector, setShowExcludeProductSelector] = useState(false)
  const [showExcludeVariantSelector, setShowExcludeVariantSelector] = useState(false)
  const [variantEditSearchValue, setVariantEditSearchValue] = useState<string | undefined>(undefined)

  // Selected products/variants data for display - initialize with data from add-on
  const [selectedProductsData, setSelectedProductsData] = useState<SelectedProduct[]>(initialSelectedProductsData)
  const [selectedTriggerVariantsData, setSelectedTriggerVariantsData] = useState<SelectedTriggerVariant[]>(
    initialSelectedTriggerVariantsData
  )
  const [selectedVariantData, setSelectedVariantData] = useState<SelectedVariantData | null>(initialSelectedVariantData)
  const [selectedExcludeProductsData, setSelectedExcludeProductsData] = useState<SelectedProduct[]>(
    initialSelectedExcludeProductsData
  )
  const [selectedExcludeVariantsData, setSelectedExcludeVariantsData] = useState<SelectedTriggerVariant[]>(
    initialSelectedExcludeVariantsData
  )

  // Check if upsell product variant has a TailorKit integration
  // Derive from fetcher data (after product change) or loader data (initial load)
  const integrationFetcher = useFetcher<{ success: boolean; data?: { isIntegrated: boolean } }>()
  const isUpsellProductIntegrated = integrationFetcher.data?.success
    ? (integrationFetcher.data.data?.isIntegrated ?? false)
    : initialIsUpsellProductIntegrated

  const checkVariantIntegration = useCallback(
    (variantGid: string) => {
      const formData = new FormData()
      formData.append('action', 'check_variant_integration')
      formData.append('variantGid', variantGid)
      integrationFetcher.submit(formData, { method: 'post', action: '/api/checkboxes' })
    },
    [integrationFetcher]
  )

  // Detect if form has changes
  const hasChanges = useMemo(() => !isEqual(formState, initialState), [formState, initialState])

  // Close installation guide modal when unmounting
  useEffect(() => {
    return () => {
      closeModal(MODAL_ID.INSTALL_CHECKBOX_MODAL)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle view installation guide
  const handleViewInstallationGuide = useCallback(() => {
    openModal(MODAL_ID.INSTALL_CHECKBOX_MODAL, { active: true })
  }, [openModal])

  // Field update handlers
  const updateField = useCallback(<K extends keyof CheckboxFormState>(field: K, value: CheckboxFormState[K]) => {
    setFormState(prev => ({ ...prev, [field]: value }))
  }, [])

  const updateContent = useCallback((updates: Partial<CheckboxContent>) => {
    setFormState(prev => ({
      ...prev,
      checkboxContent: { ...prev.checkboxContent, ...updates },
    }))
  }, [])

  const updatePopup = useCallback((updates: Partial<Popup>) => {
    setFormState(prev => ({
      ...prev,
      popup: { ...prev.popup, ...updates },
    }))
  }, [])

  // Handle trigger product selection (multiple products, no variants)
  const handleTriggerProductSelect = useCallback(
    (products: Array<{ id: string; title: string; featuredImage?: { url: string } }>) => {
      const productIds = products.map(p => p.id)
      updateField('targetProducts', productIds)
      setSelectedProductsData(products)
      setShowTriggerProductSelector(false)
    },
    [updateField]
  )

  // Handle removing a trigger product
  const handleRemoveTriggerProduct = useCallback(
    (productId: string) => {
      updateField(
        'targetProducts',
        formState.targetProducts.filter(id => id !== productId)
      )
      setSelectedProductsData(prev => prev.filter(p => p.id !== productId))
    },
    [formState.targetProducts, updateField]
  )

  // Handle trigger variant selection (multiple variants)
  const handleTriggerVariantSelect = useCallback(
    (variants: SelectedTriggerVariant[]) => {
      const variantIds = variants.map(v => v.id)
      updateField('targetProducts', variantIds)
      setSelectedTriggerVariantsData(variants)
      setShowTriggerVariantSelector(false)
    },
    [updateField]
  )

  // Handle removing a trigger variant
  const handleRemoveTriggerVariant = useCallback(
    (variantId: string) => {
      updateField(
        'targetProducts',
        formState.targetProducts.filter(id => id !== variantId)
      )
      setSelectedTriggerVariantsData(prev => prev.filter(v => v.id !== variantId))
    },
    [formState.targetProducts, updateField]
  )

  // Handle addon product selection (single variant)
  const handleAddonProductSelect = useCallback(
    (variant: SelectedVariantData) => {
      const upsellProducts: UpsellProduct[] = [
        {
          productId: variant.product?.id || '',
          variantId: variant.id,
        },
      ]
      updateField('upsellProducts', upsellProducts)
      setSelectedVariantData(variant)

      // Also update display content with product info
      if (variant.product) {
        updateContent({
          heading: `Add ${variant.product.title}`,
          imageUrl: variant.product.featuredImage?.url || '',
        })
      }
      setShowAddonProductSelector(false)

      // Check if the selected variant has a TailorKit integration
      if (variant.id) {
        checkVariantIntegration(variant.id)
      }
    },
    [updateField, updateContent, checkVariantIntegration]
  )

  const handleExcludeProductSelect = useCallback(
    (products: SelectedProduct[]) => {
      const productIds = products.map(p => p.id)
      updateField('excludeTriggerProducts', productIds)
      setSelectedExcludeProductsData(products)
      setSelectedExcludeVariantsData([])
      setShowExcludeProductSelector(false)
    },
    [updateField]
  )

  const handleExcludeVariantSelect = useCallback(
    (variants: SelectedTriggerVariant[]) => {
      const variantIds = variants.map(v => v.id)
      updateField('excludeTriggerProducts', variantIds)
      setSelectedExcludeVariantsData(variants)
      setSelectedExcludeProductsData([])
      setShowExcludeVariantSelector(false)
    },
    [updateField]
  )

  const handleRemoveExcludeProduct = useCallback(
    (productId: string) => {
      updateField(
        'excludeTriggerProducts',
        formState.excludeTriggerProducts.filter(id => id !== productId)
      )
      setSelectedExcludeProductsData(prev => prev.filter(p => p.id !== productId))
    },
    [formState.excludeTriggerProducts, updateField]
  )

  const handleRemoveExcludeVariant = useCallback(
    (variantId: string) => {
      updateField(
        'excludeTriggerProducts',
        formState.excludeTriggerProducts.filter(id => id !== variantId)
      )
      setSelectedExcludeVariantsData(prev => prev.filter(v => v.id !== variantId))
    },
    [formState.excludeTriggerProducts, updateField]
  )

  const handleExcludeTriggerProductsTypeChange = useCallback(
    (type: ETriggerProductsType | null) => {
      updateField('excludeTriggerProductsType', type)
      updateField('excludeTriggerProducts', [])
      setSelectedExcludeProductsData([])
      setSelectedExcludeVariantsData([])
    },
    [updateField]
  )

  const handleExcludeTriggerProductsChange = useCallback(
    (products: string[]) => {
      updateField('excludeTriggerProducts', products)
      if (formState.excludeTriggerProductsType !== ETriggerProductsType.SPECIFIC_PRODUCTS) {
        setSelectedExcludeProductsData([])
      }
      if (formState.excludeTriggerProductsType !== ETriggerProductsType.SPECIFIC_VARIANTS) {
        setSelectedExcludeVariantsData([])
      }
    },
    [formState.excludeTriggerProductsType, updateField]
  )

  // Discard changes
  const handleDiscard = useCallback(() => {
    setFormState(initialState)
    setValidationErrors([])
    // Reset to initial data from loader (for edit mode) or empty arrays (for add mode)
    setSelectedProductsData(initialSelectedProductsData)
    setSelectedTriggerVariantsData(initialSelectedTriggerVariantsData)
    setSelectedVariantData(initialSelectedVariantData)
    setSelectedExcludeProductsData(initialSelectedExcludeProductsData)
    setSelectedExcludeVariantsData(initialSelectedExcludeVariantsData)
  }, [
    initialState,
    initialSelectedProductsData,
    initialSelectedTriggerVariantsData,
    initialSelectedVariantData,
    initialSelectedExcludeProductsData,
    initialSelectedExcludeVariantsData,
  ])

  // Derive saving state from fetcher
  const isSavingFromFetcher = saveFetcher.state === 'submitting' || saveFetcher.state === 'loading'

  // Handle save response
  useEffect(() => {
    if (saveFetcher.state === 'idle' && saveFetcher.data) {
      if (saveFetcher.data.success) {
        showToast(t(TOAST.SETTINGS.ADDON_SAVED))
        checkboxTracking.trackCompleted(mode === 'add' ? 'created' : 'updated')
        setIsSaving(false)
      } else {
        showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
        setIsSaving(false)
      }
    }
  }, [saveFetcher.state, saveFetcher.data, t, checkboxTracking, mode])

  // Save form using fetcher (no route revalidation)
  const handleSave = useCallback(() => {
    // Validate
    const errors = validateFormState(formState)
    if (errors.length > 0) {
      setValidationErrors(errors)
      return
    }

    setValidationErrors([])
    setIsSaving(true)

    const data = formStateToCheckboxData(formState)
    const formData = new FormData()
    formData.append('action', mode === 'add' ? 'create' : 'update')
    formData.append('data', JSON.stringify(data))

    if (mode === 'edit' && checkbox?._id) {
      formData.append('checkboxId', checkbox._id)
    }

    saveFetcher.submit(formData, { method: 'post' })

    // Track cross-product personalizer toggle on save
    if (isUpsellProductIntegrated) {
      trackAction(formState.checkboxContent.showPersonalizeButton ? 'enabled' : 'disabled', {
        location_trigger: 'checkbox_edit',
        mode,
      })
    }
  }, [formState, mode, checkbox?._id, saveFetcher, isUpsellProductIntegrated, trackAction])

  // Get error message for field
  const getFieldError = useCallback(
    (errorType: CheckboxValidationError) => {
      if (!validationErrors.includes(errorType)) return undefined
      switch (errorType) {
        case 'BLANK_TITLE':
          return t('title-required')
        case 'NO_TRIGGER_PRODUCTS':
          return t('trigger-products-required')
        case 'NO_ADDON_PRODUCT':
          return t('addon-product-required')
        case 'EMPTY_HEADING':
          return t('heading-required')
        default:
          return undefined
      }
    },
    [validationErrors, t]
  )

  // Back navigation with unsaved changes warning
  const handleBack = useCallback(() => {
    navigate(NavMenuItems.STOREFRONT_SETUP_CHECKBOXES)
  }, [navigate])

  return (
    <>
      {/* Contextual Save Bar */}
      <ContextualSaveBar
        isOpen={hasChanges}
        loading={isSaving || isSavingFromFetcher}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />

      <Page
        title={
          mode === 'add'
            ? t('create-addon')
            : formState.title.length <= 25
              ? formState.title
              : `${formState.title.substring(0, 25)}...`
        }
        fullWidth
        subtitle={mode === 'edit' && checkbox?._id ? `Widget ID: ${checkbox._id}` : undefined}
        backAction={{ content: t('add-on-products'), onAction: handleBack }}
        titleMetadata={formState.isActive ? <Badge tone="success">{t('active')}</Badge> : <Badge>{t('draft')}</Badge>}
        secondaryActions={
          mode === 'edit'
            ? [
                {
                  content: t('view-installation-guide'),
                  accessibilityLabel: t('view-installation-guide'),
                  onAction: handleViewInstallationGuide,
                },
              ]
            : undefined
        }
      >
        {/* Theme helper banner - shows when helper is disabled */}
        <EnableThemeHelperBanner
          enabledOneTickHelper={appConfig?.enabledOneTickHelper ?? true}
          oneTickHelperLink={appConfig?.oneTickHelperLink ?? ''}
          description={t('please-enable-tailorkit-theme-helper-to-display-addon-products-properly')}
          isLoading={isLoadingAppConfig}
          onRefreshConfig={onRefreshAppConfig}
        />

        {/* Validation errors banner */}
        {validationErrors.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <Banner tone="critical" title={t('fix-errors-before-saving')}>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {validationErrors.includes('BLANK_TITLE') && <li>{t('title-required')}</li>}
                {validationErrors.includes('NO_TRIGGER_PRODUCTS') && <li>{t('trigger-products-required')}</li>}
                {validationErrors.includes('NO_ADDON_PRODUCT') && <li>{t('addon-product-required')}</li>}
              </ul>
            </Banner>
          </div>
        )}

        <Box minHeight="calc(100vh - 136px)">
          <Grid gap={{ xs: '400' }}>
            {/* Settings Column */}
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 8, xl: 8 }}>
              <BlockStack gap="400">
                <WidgetConfigCard
                  title={formState.title}
                  isActive={formState.isActive}
                  titleError={getFieldError('BLANK_TITLE')}
                  onTitleChange={value => updateField('title', value)}
                  onTitleBlur={() => {
                    if (formState.title.length === 0) {
                      updateField('title', initialState.title)
                    }
                  }}
                  onStatusChange={value => updateField('isActive', value)}
                />

                <PlacementCard
                  typePlacement={formState.typePlacement}
                  hideCartDrawer={formState.hideCartDrawer}
                  onPlacementChange={value => updateField('typePlacement', value)}
                  onHideCartDrawerChange={value => updateField('hideCartDrawer', value)}
                />

                <TriggerProductsCard
                  triggerProductsType={formState.triggerProductsType}
                  targetProducts={formState.targetProducts}
                  selectedProductsData={selectedProductsData}
                  selectedVariantsData={selectedTriggerVariantsData}
                  excludeUpsellProducts={formState.excludeUpsellProducts}
                  hideAllProductsOption={hideAllProductsOption}
                  singleTriggerSelection={hideAllProductsOption}
                  error={getFieldError('NO_TRIGGER_PRODUCTS')}
                  collections={collections}
                  tags={tags}
                  vendors={vendors}
                  productTypes={productTypes}
                  excludeTriggerProductsType={formState.excludeTriggerProductsType}
                  excludeTriggerProducts={formState.excludeTriggerProducts}
                  selectedExcludeProductsData={selectedExcludeProductsData}
                  selectedExcludeVariantsData={selectedExcludeVariantsData}
                  onTriggerTypeChange={value => {
                    updateField('triggerProductsType', value)
                    // Clear target products when type changes
                    if (value === ETriggerProductsType.ALL_PRODUCTS) {
                      updateField('targetProducts', [])
                      setSelectedProductsData([])
                      setSelectedTriggerVariantsData([])
                    }
                  }}
                  onTargetProductsChange={value => updateField('targetProducts', value)}
                  onExcludeUpsellProductsChange={value => updateField('excludeUpsellProducts', value)}
                  onOpenProductSelector={() => setShowTriggerProductSelector(true)}
                  onOpenVariantSelector={productTitle => {
                    setVariantEditSearchValue(productTitle || undefined)
                    setShowTriggerVariantSelector(true)
                  }}
                  onRemoveProduct={handleRemoveTriggerProduct}
                  onRemoveVariant={handleRemoveTriggerVariant}
                  onExcludeTriggerProductsTypeChange={handleExcludeTriggerProductsTypeChange}
                  onExcludeTriggerProductsChange={handleExcludeTriggerProductsChange}
                  onOpenExcludeProductSelector={() => setShowExcludeProductSelector(true)}
                  onOpenExcludeVariantSelector={() => setShowExcludeVariantSelector(true)}
                  onRemoveExcludeProduct={handleRemoveExcludeProduct}
                  onRemoveExcludeVariant={handleRemoveExcludeVariant}
                />

                <UpsellProductCard
                  upsellProducts={formState.upsellProducts}
                  selectedVariantData={selectedVariantData}
                  canRemoveWhenTriggersCleared={formState.canRemoveWhenTriggersCleared}
                  showPersonalizeButton={formState.checkboxContent.showPersonalizeButton}
                  isUpsellProductIntegrated={isUpsellProductIntegrated}
                  error={getFieldError('NO_ADDON_PRODUCT')}
                  onCanRemoveChange={value => updateField('canRemoveWhenTriggersCleared', value)}
                  onShowPersonalizeButtonChange={value => updateContent({ showPersonalizeButton: value })}
                  onOpenProductSelector={() => setShowAddonProductSelector(true)}
                />

                <DisplayContentCard
                  checkboxContent={formState.checkboxContent}
                  typePlacement={formState.typePlacement}
                  selectedVariantData={selectedVariantData}
                  onContentChange={updateContent}
                />

                <PopupSettingsCard popup={formState.popup} onPopupChange={updatePopup} />
              </BlockStack>
            </Grid.Cell>

            {/* Preview Column */}
            <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 2, lg: 4, xl: 4 }}>
              <div className="ot-sticky-preview-card">
                <CheckboxPreview
                  formState={formState}
                  selectedVariantData={selectedVariantData}
                  checkboxStyling={checkboxStyling}
                />
              </div>
            </Grid.Cell>
          </Grid>
        </Box>
      </Page>

      {/* Trigger Products Selector */}
      <ProductSelector
        open={showTriggerProductSelector}
        multiple={!hideAllProductsOption}
        hideVariants={true}
        showDuplicateOption={false}
        allowIntegratedProducts={true}
        defaultSource="existing"
        initialSelectedProductIds={selectedProductsData.map(p => p.id).filter(Boolean) as string[]}
        onClose={() => setShowTriggerProductSelector(false)}
        onSelect={(products, _variants) => handleTriggerProductSelect(products)}
      />

      {/* Addon Variant Selector - Single variant with radio buttons */}
      <ProductSelector
        open={showAddonProductSelector}
        multiple={false}
        singleVariantSelection={true}
        showDuplicateOption={false}
        allowIntegratedProducts={true}
        embedProductInVariants={true}
        defaultSource="existing"
        initialSelectedVariantIds={selectedVariantData ? [selectedVariantData.id] : []}
        onClose={() => setShowAddonProductSelector(false)}
        onSelect={(_, variants) => variants[0] && handleAddonProductSelect(variants[0])}
      />

      {/* Trigger Variant Selector */}
      <ProductSelector
        open={showTriggerVariantSelector}
        multiple={!hideAllProductsOption}
        showDuplicateOption={false}
        allowIntegratedProducts={true}
        embedProductInVariants={true}
        defaultSource="existing"
        initialSearchValue={variantEditSearchValue}
        initialSelectedVariantIds={selectedTriggerVariantsData.map(v => v.id)}
        onClose={() => {
          setShowTriggerVariantSelector(false)
          setVariantEditSearchValue(undefined)
        }}
        onSelect={(_, variants) => handleTriggerVariantSelect(variants)}
      />

      {/* Exclude Products Selector - Multiple products, no variants */}
      <ProductSelector
        open={showExcludeProductSelector}
        multiple={true}
        hideVariants={true}
        showDuplicateOption={false}
        allowIntegratedProducts={true}
        defaultSource="existing"
        initialSelectedProductIds={selectedExcludeProductsData.map(p => p.id).filter(Boolean) as string[]}
        onClose={() => setShowExcludeProductSelector(false)}
        onSelect={(products, _variants) => handleExcludeProductSelect(products)}
      />

      {/* Exclude Variants Selector - Multiple variants */}
      <ProductSelector
        open={showExcludeVariantSelector}
        multiple={true}
        showDuplicateOption={false}
        allowIntegratedProducts={true}
        embedProductInVariants={true}
        defaultSource="existing"
        initialSelectedVariantIds={selectedExcludeVariantsData.map(v => v.id)}
        onClose={() => setShowExcludeVariantSelector(false)}
        onSelect={(_, variants) => handleExcludeVariantSelect(variants)}
      />

      <div style={{ height: '100px' }} />

      {/* Installation Guide Modal */}
      <InstallCheckboxModal typePlacement={formState.typePlacement as EPlacementType} appConfig={appConfig} />
    </>
  )
}
