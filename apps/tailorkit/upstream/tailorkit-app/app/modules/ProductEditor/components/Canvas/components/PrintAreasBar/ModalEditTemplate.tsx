import { Modal, TextField, BlockStack, Banner, InlineStack, Box, Button, Text } from '@shopify/polaris'
import { useCallback, useState, useEffect, useMemo, useRef, Fragment } from 'react'
import type { PrintArea, VariantIntegration } from '~/types/integration'
import { useTranslation } from 'react-i18next'
import { TEMPLATES_ACTIONS } from '~/routes/api.templates/constants'
import { getTemplateDimensions, getTemplateTitle } from './utils/generateDefaultTemplateName'
import { PlusIcon, UploadIcon, XIcon } from '@shopify/polaris-icons'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import type { Template } from '~/types/psd'
import type { TemporarySelectedTemplate } from './hooks/usePrintAreaActions'
import TemplateDesignTypeSelector from '~/modules/TemplateEditor/modals/TemplateDesignTypeSelector'
import TemplateSaveThumbnailCheckbox from '~/modules/TemplateEditor/modals/TemplateSaveThumbnailCheckbox'
import { DEFAULT_TEMPLATE_EDITOR_STORE, TemplateEditorStore } from '~/stores/modules/template'
import { DEFAULT_PRINT_AREA } from '~/stores/modules/integration/integration'
import { useStore } from '~/libs/external-store'

interface ModalEditTemplateProps {
  active: boolean
  isPODProduct: boolean
  onClose: () => void
  printArea: PrintArea | null
  allPrintAreas: PrintArea[]
  productTitle?: string
  variantTitle?: string
  activeVariant?: VariantIntegration
  temporarySelectedTemplate: TemporarySelectedTemplate
  onSave: (
    printAreaId: string,
    data: { name: string; width: number; height: number },
    temporarySelectedTemplate?: TemporarySelectedTemplate
  ) => void
  handleSelectTemporaryTemplate: (
    template: Template | File | null,
    source: 'existing' | 'psd' | '',
    applyTemplateDimensionToPrintArea?: boolean
  ) => void
}

export default function ModalEditTemplate({
  active,
  isPODProduct = false,
  onClose,
  printArea,
  allPrintAreas,
  productTitle,
  variantTitle,
  activeVariant,
  temporarySelectedTemplate,
  onSave,
  handleSelectTemporaryTemplate,
}: ModalEditTemplateProps) {
  const { t } = useTranslation()

  const { state } = useModal()
  const selectTemplateModalOpen = state?.[MODAL_ID.SELECT_EXISTING_TEMPLATE_MODAL]?.active

  const [name, setName] = useState(printArea?.name || '')
  const [width, setWidth] = useState(printArea?.width?.toString() || '')
  const [height, setHeight] = useState(printArea?.height?.toString() || '')
  const [isTemplateUsedElsewhere, setIsTemplateUsedElsewhere] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const isDesignMode = !isPODProduct

  // Get saveThumbnailWithPreview and previewProductImage from TemplateEditorStore
  const saveThumbnailWithPreview = useStore(
    TemplateEditorStore,
    state => state.metadata?.saveThumbnailWithPreview ?? false
  )
  const previewProductImage = useStore(TemplateEditorStore, state => state.previewProductImage)
  const isPreviewImageVisible = useMemo(() => {
    return !!(previewProductImage && previewProductImage.visible !== false)
  }, [previewProductImage])

  const setSaveThumbnailWithPreview = useCallback((value: boolean) => {
    TemplateEditorStore.dispatch({
      type: 'SET_METADATA_SAVE_THUMBNAIL_WITH_PREVIEW',
      payload: { saveThumbnailWithPreview: value },
    })
  }, [])

  const templateCategory = useMemo(() => {
    if (!printArea) return undefined
    const template = typeof printArea.template === 'object' ? printArea.template : null
    return template?.category
  }, [printArea])

  const lastSyncedCategory = useRef<string | undefined>()

  if (isDesignMode && typeof templateCategory !== 'undefined' && lastSyncedCategory.current !== templateCategory) {
    const currentCategory = TemplateEditorStore.getState().category
    if (currentCategory !== templateCategory) {
      TemplateEditorStore.dispatch({ type: 'SET_CATEGORY', payload: { category: templateCategory } })
    }

    lastSyncedCategory.current = templateCategory
  }

  const applyTemplateDimensionToPrintArea = useMemo(() => {
    if (isPODProduct) {
      return temporarySelectedTemplate?.applyTemplateDimensionToPrintArea ?? true
    }
    return printArea
  }, [isPODProduct, printArea, temporarySelectedTemplate?.applyTemplateDimensionToPrintArea])

  const isChanged = useMemo(() => {
    return width !== String(printArea?.width) || height !== String(printArea?.height)
  }, [width, height, printArea])

  const _isTemplateUsedElsewhere = useMemo(() => {
    return isTemplateUsedElsewhere && isChanged
  }, [isChanged, isTemplateUsedElsewhere])

  const templateTitle = useMemo(() => {
    if (!printArea) {
      return DEFAULT_TEMPLATE_EDITOR_STORE.name
    }

    const defaultTitle = getTemplateTitle(printArea, productTitle, variantTitle)
    return applyTemplateDimensionToPrintArea ? defaultTitle : printArea.name
  }, [applyTemplateDimensionToPrintArea, printArea, productTitle, variantTitle])

  // Get dimensions from print area or template
  const { width: printAreaWidth, height: printAreaHeight } = useMemo(() => {
    if (!printArea) {
      return {
        width: DEFAULT_PRINT_AREA.width,
        height: DEFAULT_PRINT_AREA.height,
      }
    }
    return getTemplateDimensions(printArea)
  }, [printArea])

  const dismissBanner = useCallback(() => {
    setDismissed(true)
  }, [])

  // Check if the template is used in other print areas (both in database and current unsaved state)
  useEffect(() => {
    const checkTemplateUsage = async () => {
      if (!active || !printArea) {
        setIsTemplateUsedElsewhere(false)
        return
      }

      const template = typeof printArea.template === 'object' ? printArea.template : null
      if (!template?._id) {
        setIsTemplateUsedElsewhere(false)
        return
      }

      // First, check client-side (current unsaved print areas)
      const clientUsageCount = allPrintAreas.filter(pa => {
        const paTemplate = typeof pa.template === 'object' ? pa.template : null
        return paTemplate?._id === template._id
      }).length

      // If already used multiple times in client, show warning immediately
      if (clientUsageCount > 1) {
        setIsTemplateUsedElsewhere(true)
        return
      }

      // Then check database for saved print areas
      try {
        const response = await fetch(`/api/templates?action=${TEMPLATES_ACTIONS.CHECK_TEMPLATE_USAGE}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            templateId: template._id,
            currentPrintAreaId: printArea._id,
          }),
        })

        if (response.ok) {
          const data = await response.json()

          // Combine client and database usage
          const dbUsageCount = data.usageCount || 0
          const usedIn = data.printAreaIds || []
          const usedInCurrent = usedIn.includes(printArea?._id || '')
          const totalUsage = clientUsageCount + dbUsageCount - (usedInCurrent ? 1 : 0)

          // Show warning if:
          // 1. Used multiple times in client (already handled above)
          // 2. Used in database AND currently being used in client
          // 3. Used multiple times in database
          setIsTemplateUsedElsewhere(totalUsage > clientUsageCount || dbUsageCount > 1)
        } else {
          // Fallback to client-side check only
          setIsTemplateUsedElsewhere(clientUsageCount > 1)
        }
      } catch (error) {
        console.error('Error checking template usage:', error)
        // Fallback to client-side check only
        setIsTemplateUsedElsewhere(clientUsageCount > 1)
      }
    }

    checkTemplateUsage()
  }, [active, printArea, allPrintAreas])

  // Initialize form when printArea changes
  useEffect(() => {
    if (printArea) {
      const template = typeof printArea.template === 'object' ? printArea.template : null
      const templateName = template?.name || ''

      /**
       * Converts a numeric dimension value to a rounded string, or returns empty string if falsy
       */
      const toRoundedString = (value: number | undefined | null): string => (value ? String(Math.round(value)) : '')
      if (temporarySelectedTemplate?.template) {
        setName(temporarySelectedTemplate.template.name)
      } else {
        // Use template name directly if exists (source of truth), otherwise fallback to templateTitle
        // This ensures edited template names (without prefix) are displayed correctly
        setName(templateName || templateTitle)
      }

      const defaultWidth = toRoundedString(printAreaWidth)
      const defaultHeight = toRoundedString(printAreaHeight)

      const templateWidth = toRoundedString(template?.dimension?.width) || defaultWidth
      const templateHeight = toRoundedString(template?.dimension?.height) || defaultHeight

      const tempTemplate = temporarySelectedTemplate?.template
      const isTempTemplate = tempTemplate && typeof tempTemplate === 'object' && 'dimension' in tempTemplate
      const tempTemplateWidth = toRoundedString(isTempTemplate ? tempTemplate.dimension?.width : undefined)
      const tempTemplateHeight = toRoundedString(isTempTemplate ? tempTemplate.dimension?.height : undefined)

      const finalWidth = applyTemplateDimensionToPrintArea ? tempTemplateWidth || templateWidth : defaultWidth
      const finalHeight = applyTemplateDimensionToPrintArea ? tempTemplateHeight || templateHeight : defaultHeight

      setWidth(finalWidth)
      setHeight(finalHeight)
    }
  }, [
    printArea,
    productTitle,
    variantTitle,
    applyTemplateDimensionToPrintArea,
    temporarySelectedTemplate?.template,
    printAreaWidth,
    printAreaHeight,
    templateTitle,
  ])

  const handleSave = useCallback(async () => {
    if (!printArea) return

    const parsedWidth = parseInt(width, 10)
    const parsedHeight = parseInt(height, 10)

    if (isNaN(parsedWidth) || isNaN(parsedHeight) || parsedWidth <= 0 || parsedHeight <= 0) {
      return
    }

    // Save the edit data (name, width, height) only if no template was selected
    onSave(
      printArea._id,
      {
        name: name.trim(),
        width: parsedWidth,
        height: parsedHeight,
      },
      temporarySelectedTemplate?.template ? temporarySelectedTemplate : undefined
    )

    onClose()
  }, [printArea, width, height, onSave, name, temporarySelectedTemplate, onClose])

  const handleCancel = useCallback(() => {
    onClose()
  }, [onClose])

  // Validate form
  const parsedWidth = parseInt(width, 10)
  const parsedHeight = parseInt(height, 10)
  const isValid = Boolean(
    name.trim().length > 0 && !isNaN(parsedWidth) && !isNaN(parsedHeight) && parsedWidth > 0 && parsedHeight > 0
  )

  return (
    <Modal
      open={active && !selectTemplateModalOpen}
      onClose={handleCancel}
      title={t('edit-template')}
      primaryAction={{
        content: t('done'),
        onAction: handleSave,
        disabled: !isValid,
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: handleCancel,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="300">
          {/* Warning banner if template is used in other print areas */}
          {_isTemplateUsedElsewhere && !dismissed && (
            <Banner tone="warning" onDismiss={dismissBanner}>
              {t('you-can-change-the-dimensions-but-it-may-also-update-other-products-using-this-template')}
            </Banner>
          )}

          {isPODProduct && printArea && <PODProductInformation printArea={printArea} />}
          <TextField label={t('template-title')} value={name} onChange={setName} autoComplete="off" maxLength={100} />

          {isPODProduct ? (
            <InlineStack gap="200" align="space-between" blockAlign="center" wrap={false}>
              <Box width="100%">
                <TextField
                  label={t('width')}
                  value={width}
                  onChange={setWidth}
                  type="number"
                  suffix="px"
                  autoComplete="off"
                  min={1}
                />
              </Box>
              <Box width="100%">
                <TextField
                  label={t('height')}
                  value={height}
                  onChange={setHeight}
                  type="number"
                  suffix="px"
                  autoComplete="off"
                  min={1}
                />
              </Box>
            </InlineStack>
          ) : (
            <Fragment>
              <Box width="100%">
                <TextField
                  label={t('width')}
                  value={width}
                  onChange={setWidth}
                  type="number"
                  suffix="px"
                  autoComplete="off"
                  min={1}
                />
              </Box>
              <Box width="100%">
                <TextField
                  label={t('height')}
                  value={height}
                  onChange={setHeight}
                  type="number"
                  suffix="px"
                  autoComplete="off"
                  min={1}
                />
              </Box>
            </Fragment>
          )}
          {isDesignMode && <TemplateDesignTypeSelector />}
          {isDesignMode && (
            <TemplateSaveThumbnailCheckbox
              saveThumbnailWithPreview={saveThumbnailWithPreview}
              setSaveThumbnailWithPreview={setSaveThumbnailWithPreview}
              isPreviewImageVisible={isPreviewImageVisible}
            />
          )}
          {printArea && activeVariant && isPODProduct && (
            <AddTemplateFields
              temporarySelectedTemplate={temporarySelectedTemplate || null}
              handleSelectTemporaryTemplate={handleSelectTemporaryTemplate}
            />
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  )
}

const PODProductInformation = (props: { printArea: PrintArea }) => {
  const { printArea } = props
  const { name = '', width = 0, height = 0 } = printArea
  const { t } = useTranslation()

  return (
    <BlockStack gap="300">
      <TextField autoComplete="off" readOnly label={t('print-area')} value={name} />
      <InlineStack gap="200" align="space-between" blockAlign="center" wrap={false}>
        <Box width="100%">
          <TextField autoComplete="off" readOnly label={t('width')} value={width.toString()} suffix="px" />
        </Box>
        <Box width="100%">
          <TextField autoComplete="off" readOnly label={t('height')} value={height.toString()} suffix="px" />
        </Box>
      </InlineStack>
    </BlockStack>
  )
}

interface AddTemplateFieldsProps {
  temporarySelectedTemplate: TemporarySelectedTemplate
  handleSelectTemporaryTemplate: (
    template: Template | File | null,
    source: 'existing' | 'psd' | '',
    applyTemplateDimensionToPrintArea?: boolean
  ) => void
}

/**
 * Renders actions that allow merchants to attach templates or PSD files to the current print area.
 */
const AddTemplateFields = (props: AddTemplateFieldsProps) => {
  const { temporarySelectedTemplate, handleSelectTemporaryTemplate } = props
  const { t } = useTranslation()
  const { openModal } = useModal()

  const handleSelectExistingTemplate = useCallback(() => {
    openModal(MODAL_ID.SELECT_EXISTING_TEMPLATE_MODAL, {
      onSelectTemplate: (template: Template) => handleSelectTemporaryTemplate(template, 'existing'),
    })
  }, [handleSelectTemporaryTemplate, openModal])

  const handleUploadPSDClick = useCallback(() => {
    openModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL_FOR_NEW_TEMPLATE, {
      onFileSelected: (file: File) => handleSelectTemporaryTemplate(file, 'psd'),
    })
  }, [handleSelectTemporaryTemplate, openModal])

  return (
    <>
      <InlineStack gap="200" align="space-between" blockAlign="center" wrap={false}>
        <Box width="100%">
          <Button icon={PlusIcon} fullWidth onClick={handleSelectExistingTemplate}>
            {t('select-existing-template')}
          </Button>
        </Box>
        <Box width="100%">
          <Button icon={UploadIcon} fullWidth onClick={handleUploadPSDClick}>
            {t('upload-psd-file')}
          </Button>
        </Box>
      </InlineStack>

      {temporarySelectedTemplate?.template && (
        <Box paddingBlockStart="200">
          <InlineStack gap="200" blockAlign="center" wrap={false}>
            <Box maxWidth="calc(100% - 28px)">
              <Text as="span" variant="bodyMd" truncate>
                {temporarySelectedTemplate.template?.name}
              </Text>
            </Box>
            <Button variant="monochromePlain" icon={XIcon} onClick={() => handleSelectTemporaryTemplate(null, '')} />
          </InlineStack>
        </Box>
      )}
    </>
  )
}
