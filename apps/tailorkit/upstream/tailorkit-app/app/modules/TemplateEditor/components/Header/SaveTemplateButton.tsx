import {
  Icon,
  BlockStack,
  Box,
  Button,
  InlineStack,
  Modal,
  ResourceList,
  Scrollable,
  Text,
  TextField,
  Divider,
} from '@shopify/polaris'
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useSearchParams } from '@remix-run/react'
import type { WithTranslationProps } from '~/bootstrap/hoc/withTranslation'
import { MODAL_ID } from '~/constants/modal'
import { useStore } from '~/libs/external-store'
import { modalStore } from '~/stores/modal'
import { TemplateEditorStore } from '~/stores/modules/template'
import {
  MUTATION_LAYER_FROM_INSPECTOR_EVENTS,
  TEMPLATE_EDITOR_CTA_IDS,
  TEMPLATE_EDITOR_TRANSMISSION_EVENTS,
} from '../../constants'
import { ProgressStore } from '~/stores/canvas/progress'
import { Transmitter } from 'extensions/tailorkit-src/src/assets/libraries/transmitter'
import isArray from 'lodash/isArray'
import { TOAST } from '~/constants/toasts'
import { showToast } from '~/utils/toastEvents'
import { TemplateEditorContext } from '../../context'
import isEmpty from 'lodash/isEmpty'
import { Trans } from 'react-i18next'
import ProductSelector from '~/modules/ProductSelector'
import { useEventsTracking } from '~/bootstrap/hooks/useEventsTracking'
import useInitIntegration from '~/modules/ProductEditor/hooks/useInitIntegration'
import { uuid } from '~/utils/uuid'
import { buildPrebuiltPrintAreas } from '~/modules/ProductEditor/utilities/prebuiltPrintAreas'
import { sendMessageToMainApp } from '~/utils/modalEvents'
import { EActionType } from '~/constants/fetcher-keys'
import ProductItem from '~/modules/ProductSelector/ProductList/ProductItem'
import InlineLoading from '~/components/loading/InlineLoading'
import { authenticatedFetch } from '~/shopify/fns.client'
import { EditIcon, SearchIcon, ViewIcon } from '@shopify/polaris-icons'
import { getIdNumberFromIdString } from '~/shopify/fns'
import { useRootLoaderData } from '~/root'
import RepublishProductsModal from '../../modals/RepublishProductsModal'
import { INTEGRATION_ACTION } from '~/routes/api.integrations/constants'
import { LayerToolMap } from '../Outline/LayerToolbar/constants'
import { NavMenuItems } from '~/bootstrap/app-config'
import type { IProduct, IVariant } from '~/types/shopify-product'
import { trackEventStartCreateProduct } from '~/routes/personalized-products._index/fns/eventTracking'

export function SaveTemplateButton(props: WithTranslationProps) {
  const { t } = props
  const [searchParams] = useSearchParams()
  const [modalDiscardConfirmationActive, setModalDiscardConfirmationActive] = useState(false)

  const extractedLayerStores = useStore(TemplateEditorStore, state => state.extractedLayerStores)

  const hasLayer = useMemo(() => extractedLayerStores.length > 0, [extractedLayerStores.length])

  // const { onDiscardTemplate } = useDiscardTemplate()

  const index = useStore(ProgressStore, state => state.index)
  const total = useStore(ProgressStore, state => state.total)

  const isSaving = useMemo(() => index >= 0 && total > 0, [index, total])

  const { validationErrors, resetValidationErrors } = useContext(TemplateEditorContext)

  const [publishedIntegrations, setPublishedIntegrations] = useState<any[]>([])

  // Determine if current shop is the STORE_ASSET_DOMAIN
  const { shopData, PUBLIC_ENV } = useRootLoaderData()
  const isStoreAssetShop = useMemo(
    () => !!shopData?.shopDomain && shopData.shopDomain === PUBLIC_ENV?.STORE_ASSET_DOMAIN,
    [shopData?.shopDomain, PUBLIC_ENV?.STORE_ASSET_DOMAIN]
  )

  useEffect(() => {
    ;(async () => {
      const templateId = TemplateEditorStore.getState()._id
      const response = await authenticatedFetch(
        `/api/integrations?action=${INTEGRATION_ACTION.FETCH_INTEGRATIONS_BY_TEMPLATE}`,
        {
          method: 'POST',
          body: JSON.stringify({ templateId }),
        }
      )

      setPublishedIntegrations(response.integrations || [])
    })()
  }, [])

  const onOpenSaveTemplateModal = useCallback(() => {
    // Check if template has any errors
    if (!isEmpty(validationErrors)) {
      const errorKeys = Object.keys(validationErrors)
      const optionSetErrors = errorKeys.filter(key => key.includes(`-optionSet-`))

      // When user clicks on the save template button,
      // if there are any option set errors, we will clear them because the system auto removed the invalid option set data
      const nextValidationErrors = { ...validationErrors }
      if (optionSetErrors.length > 0) {
        optionSetErrors.forEach(errorKey => {
          delete nextValidationErrors[errorKey]
        })
      }

      const finalValidationErrorsObj = Object.fromEntries(
        Object.entries(nextValidationErrors).filter(([, v]) => Boolean(v))
      )
      resetValidationErrors(finalValidationErrorsObj)

      if (!isEmpty(finalValidationErrorsObj)) {
        Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.TOGGLE_LAYER_TOOL_PANEL, {
          toolId: LayerToolMap.LAYERS_LISTING,
        })
        // Wait for the layer tool panel to be toggled before shaking the validation error layers
        setTimeout(() => {
          Transmitter.trigger(
            MUTATION_LAYER_FROM_INSPECTOR_EVENTS.SHAKE_VALIDATION_ERROR_LAYERS,
            finalValidationErrorsObj
          )
        }, 500)
        showToast(t(TOAST.TEMPLATE_EDITOR.TEMPLATE_ERROR), { isError: true })
        return
      }
    }

    // Open save template modal if any progress is being made
    // OR when current shop is STORE_ASSET_DOMAIN
    if (isSaving || isStoreAssetShop) {
      modalStore.dispatch({
        type: 'OPEN_MODAL',
        payload: {
          key: MODAL_ID.SAVE_TEMPLATE_MODAL,
        },
      })

      return
    }

    const activeVariantIntegration = TemplateEditorStore.getState().activeVariantIntegration
    if (
      publishedIntegrations.length > 0
      || (!publishedIntegrations.length && isArray(activeVariantIntegration) && activeVariantIntegration.length > 0)
    ) {
      modalStore.dispatch({
        type: 'OPEN_MODAL',
        payload: {
          key: MODAL_ID.REPUBLISH_EDITOR_MODAL,
          data: {
            ...(activeVariantIntegration
              ? {
                  activeVariantIntegrationIds: activeVariantIntegration
                    .map(variantIntegration => variantIntegration._id)
                    .filter(Boolean),
                }
              : {}),
            ...(publishedIntegrations.length > 0
              ? {
                  publishedIntegrationsIds: publishedIntegrations.map(integration => integration._id).filter(Boolean),
                }
              : {}),
          },
        },
      })

      return
    }

    showToast(t(TOAST.TEMPLATE_EDITOR.SAVING_TEMPLATE))
    Transmitter.trigger(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.SAVE_TEMPLATE)
  }, [isSaving, isStoreAssetShop, publishedIntegrations, resetValidationErrors, t, validationErrors])

  const onHandleChangeActiveModalConfirmation = useCallback(() => {
    setModalDiscardConfirmationActive(!modalDiscardConfirmationActive)
  }, [modalDiscardConfirmationActive])

  const onDiscardTemplateHandler = useCallback(() => {
    onHandleChangeActiveModalConfirmation()
  }, [onHandleChangeActiveModalConfirmation])

  // const onDiscardHandler = useCallback(() => {
  //   // Discard template
  //   onDiscardTemplate()

  //   // Close modal
  //   onHandleChangeActiveModalConfirmation()
  // }, [onDiscardTemplate, onHandleChangeActiveModalConfirmation])

  // Apply template to products modal
  const { trackEvent } = useEventsTracking()
  const { prepareVariantsSelected } = useInitIntegration()

  const [modalApplyTemplateActive, setModalApplyTemplateActive] = useState(false)
  const [modalProductSelectorActive, setModalProductSelectorActive] = useState(false)
  const [modalViewIntegratedProductActive, setModalViewIntegratedProductActive] = useState(false)

  const onHandleChangeActiveModalApplyTemplate = useCallback(
    (active?: boolean) => {
      setModalApplyTemplateActive(typeof active === 'boolean' ? active : !modalApplyTemplateActive)

      if (modalApplyTemplateActive) {
        // Send message to main app
        sendMessageToMainApp(JSON.stringify({ type: EActionType.SAVED_TEMPLATE }))
      }
    },
    [modalApplyTemplateActive]
  )

  const onHandleChangeActiveModalViewIntegratedProduct = useCallback(
    (active?: boolean) => {
      setModalViewIntegratedProductActive(typeof active === 'boolean' ? active : !modalViewIntegratedProductActive)
    },
    [modalViewIntegratedProductActive]
  )

  const onHandleChangeActiveModalProductSelector = useCallback(() => {
    onHandleChangeActiveModalApplyTemplate(false)
    onHandleChangeActiveModalViewIntegratedProduct(false)
    setModalProductSelectorActive(!modalProductSelectorActive)
  }, [
    modalProductSelectorActive,
    onHandleChangeActiveModalApplyTemplate,
    onHandleChangeActiveModalViewIntegratedProduct,
  ])

  const handleProductSelect = useCallback(
    async (_products: IProduct[], variants: IVariant[]) => {
      trackEventStartCreateProduct(trackEvent)

      try {
        const { _id, shopDomain, dimension, name, previewUrl } = TemplateEditorStore.getState()

        // Build prebuilt print areas map for stable IDs in URL and generator
        const { prebuiltPrintAreasByVariantId, selectedPrintAreaId } = buildPrebuiltPrintAreas(variants as any)

        const integrationUrl = await prepareVariantsSelected({
          variants,
          integrationId: uuid(),
          template: {
            _id,
            name,
            dimension,
            shopDomain,
            updatedAt: new Date().toISOString(),
            previewUrl: window.savedTemplate?.previewUrl || previewUrl,
          },
          prebuiltPrintAreasByVariantId,
          selectedPrintAreaId,
        })

        // Send message to main app to navigate to the template creation page
        sendMessageToMainApp(JSON.stringify({ type: EActionType.NAVIGATE_MAX_MODAL, url: integrationUrl }))
      } catch (error) {
        console.error('Failed to initialize personalized product editor:', error)
      }
    },
    [prepareVariantsSelected, trackEvent]
  )

  useLayoutEffect(() => {
    const onSaved = () => {
      // Check if Template Editor was opened from personalized product editor context
      // The 'fallback-url' parameter indicates the Template Editor should return to a specific page
      // (e.g., when opened from personalized product editor)
      const fallbackUrl = searchParams.get('fallback-url')
      const data = TemplateEditorStore.getState()

      // Only show the "Apply template to product" modal if NOT opened from personalized product editor
      // This prevents the modal from showing inappropriately when user is already working on a personalized product
      if (!fallbackUrl && !(data?.isCreatingNew || data?.activeVariantIntegration?.length)) {
        setModalApplyTemplateActive(true)
      }

      // Send message to main app
      sendMessageToMainApp(JSON.stringify({ type: EActionType.SAVED_TEMPLATE }))
    }

    // Listen for the saved event
    Transmitter.listen(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.SAVED_TEMPLATE, onSaved)

    return () => Transmitter.remove(TEMPLATE_EDITOR_TRANSMISSION_EVENTS.SAVED_TEMPLATE, onSaved)
  }, [searchParams])

  return (
    <div style={{ visibility: 'hidden', position: 'absolute', right: '20px', top: '-30px' }}>
      <InlineStack gap={'200'}>
        <Button
          id={TEMPLATE_EDITOR_CTA_IDS.SELECT_PRODUCT}
          variant="secondary"
          onClick={onHandleChangeActiveModalProductSelector}
        >
          {t('create-personalized-product')}
        </Button>
        <Button
          id={TEMPLATE_EDITOR_CTA_IDS.VIEW_INTEGRATED_PRODUCT}
          variant="secondary"
          onClick={onHandleChangeActiveModalViewIntegratedProduct}
        >
          {t('view-personalized-products')}
        </Button>
        <Button id={TEMPLATE_EDITOR_CTA_IDS.DISCARD_TEMPLATE} variant="secondary" onClick={onDiscardTemplateHandler}>
          {t('discard')}
        </Button>
        <Button
          id={TEMPLATE_EDITOR_CTA_IDS.SAVE_TEMPLATE}
          variant="primary"
          onClick={onOpenSaveTemplateModal}
          disabled={!hasLayer}
        >
          {t('save')}
        </Button>
      </InlineStack>

      {/* <ModalDiscardConfirmation
        active={modalDiscardConfirmationActive}
        handleChange={onHandleChangeActiveModalConfirmation}
        onDiscard={onDiscardHandler}
      /> */}

      {/* Apply template to product modal */}
      <Modal
        title={t('apply-template-to-product')}
        open={modalApplyTemplateActive}
        onClose={onHandleChangeActiveModalApplyTemplate}
        primaryAction={{
          content: t('create-personalized-product'),
          onAction: onHandleChangeActiveModalProductSelector,
        }}
        secondaryActions={[
          {
            content: t('back-to-template'),
            onAction: onHandleChangeActiveModalApplyTemplate,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="200">
            <Text as="p" variant="bodyMd">
              {t('your-template-has-been-saved-you-can-keep-editing-it-or-select-a-product-to-apply-it-to')}
            </Text>
            <Text as="p" variant="bodyMd">
              <Trans t={t} components={{ b: <b /> }}>
                {t(
                  'b-note-b-if-the-product-s-personalization-area-size-differs-from-the-template-the-layout-may-need-adjustment'
                )}
              </Trans>
            </Text>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* View integrated product modal */}
      <ViewIntegratedProductModal
        t={t}
        active={modalViewIntegratedProductActive}
        templateId={TemplateEditorStore.getState()._id}
        onCreate={onHandleChangeActiveModalProductSelector}
        onClose={onHandleChangeActiveModalViewIntegratedProduct}
      />

      {/* Product selector modal */}
      <ProductSelector
        onSelect={handleProductSelect}
        open={modalProductSelectorActive}
        onClose={onHandleChangeActiveModalProductSelector}
      />

      {/* Republish products modal */}
      <RepublishProductsModal />
    </div>
  )
}

function ViewIntegratedProductModal(props: any) {
  const { t, active, onClose, onCreate, templateId } = props

  const {
    shopData: { shopDomain },
  } = useRootLoaderData()

  const [loading, setLoading] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [products, setProducts] = useState<any[]>([])

  const filteredPoducts = useMemo(
    () => products.filter((product: any) => product.title.toLowerCase().includes(searchValue.toLowerCase())),
    [products, searchValue]
  )

  useLayoutEffect(() => {
    if (active && templateId) {
      setLoading(true)

      authenticatedFetch(`/api/products/?templateId=${templateId}`).then(res => {
        setLoading(false)
        setProducts(res?.items || [])
      })
    }
  }, [active, templateId])

  const viewLiveProduct = useCallback(
    (item: any) => {
      if (item.status === 'ACTIVE') {
        const firstIntegratedVariant = item.variants.find((v: any) => v.integrated)
        const variantIdNumber = getIdNumberFromIdString(firstIntegratedVariant.id)
        const previewUrl = `https://${shopDomain}/products/${item?.handle}?v=${variantIdNumber}`

        window.open(previewUrl)
      }
    },
    [shopDomain]
  )

  const editIntegratedProduct = useCallback((item: any) => {
    // Send message to main app
    sendMessageToMainApp(
      JSON.stringify({
        type: EActionType.NAVIGATE_MAX_MODAL,
        url: `${NavMenuItems.PERSONALIZED_PRODUCTS}/${item.integrationId}?mockup=${item.mockupId}`,
      })
    )
  }, [])

  const isPublished = useCallback((item: any) => item.status === 'ACTIVE' && item.publishedAt, [])

  return (
    <Modal
      title={t('personalized-products')}
      open={active}
      onClose={onClose}
      secondaryActions={[
        {
          content: t('close'),
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="200">
          <TextField
            clearButton
            labelHidden
            label=""
            autoComplete="off"
            value={searchValue}
            onChange={setSearchValue}
            placeholder={t('search-products')}
            prefix={<Icon source={SearchIcon} />}
            onClearButtonClick={() => setSearchValue('')}
          />

          <InlineStack align="end">
            <Button variant="primary" onClick={onCreate}>
              {t('create-personalized-product')}
            </Button>
          </InlineStack>
        </BlockStack>
      </Modal.Section>

      <Divider />

      <Modal.Section>
        <Scrollable style={{ maxHeight: '420px' }}>
          {filteredPoducts.length > 0 ? (
            <Box paddingBlockStart="0" paddingBlockEnd="0">
              <ResourceList
                items={filteredPoducts}
                renderItem={item => (
                  <ProductItem
                    product={item}
                    selectable={false}
                    showProductStatus={true}
                    getProductStatus={isPublished}
                    actions={[
                      ...(isPublished(item)
                        ? [
                            {
                              icon: ViewIcon,
                              label: t('view-live'),
                              onAction: () => viewLiveProduct(item),
                            },
                          ]
                        : []),
                      {
                        icon: EditIcon,
                        label: t('edit'),
                        onAction: () => editIntegratedProduct(item),
                      },
                    ]}
                  />
                )}
              />
            </Box>
          ) : (
            <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
              {loading ? (
                <InlineLoading />
              ) : searchValue ? (
                t('no-products-found-please-refine-your-filters')
              ) : (
                t('no-products-found')
              )}
            </Text>
          )}
        </Scrollable>
      </Modal.Section>
    </Modal>
  )
}

/**
 * Clean up original layers inside of all multi layout elements and bring back these to outline because these layers are temporary.
 * @param extractedLayerStores
 */
// function cleanUpTemporaryLayersInsideMultiLayoutElements(extractedLayerStores: TLayerStore[]) {
//   const multiLayoutElements = extractedLayerStores.filter(layerStore => layerStore.getState().type === 'multi-layout')
//   multiLayoutElements.forEach(multiLayoutElement => {
//     const state = multiLayoutElement.getState()
//     const optionSets = state.optionSet || []

//     const multi_layout_option = optionSets.find(optionSet => optionSet.type === EOptionSet.MULTI_LAYOUT_OPTION)

//     if (!multi_layout_option) return

//     const originalLayersSelected = multi_layout_option.data?.multi_layout?.originalLayersSelected || []

//     const currentExtractedLayerStore = TemplateEditorStoreActions.getExtractedLayerStores()

//     // Get originalLayerSelectedStores
//     const originalLayerSelectedStores = originalLayersSelected
//       .map(layerId => getLayerStoreById(layerId))
//       .filter(layerStore => !!layerStore)

//     // Evaluate layer position after deleting all layout
//     const _extractedLayerStores = evaluateLayerPositionAfterDeletingAllLayout(
//       currentExtractedLayerStore,
//       originalLayerSelectedStores
//     )

//     TemplateEditorStoreActions.setExtractedLayerStores(_extractedLayerStores)

//     const updatedOptionSet: MULTI_LAYOUT_OPTION_SET = {
//       ...multi_layout_option,
//       data: {
//         multi_layout: {
//           ...(multi_layout_option.data!.multi_layout ?? {}),
//           originalLayersSelected: [],
//         },
//       },
//     }

//     // Clean up original layer selected
//     multiLayoutElement.dispatch({
//       type: 'UPDATE_OPTION_SET',
//       payload: {
//         optionSet: updatedOptionSet,
//       },
//     })
//   })
// }
