import { Box, Button, InlineStack, Text, Tooltip, Modal, BlockStack, Icon } from '@shopify/polaris'
import { EditIcon, DeleteIcon, ChevronLeftIcon, ChevronRightIcon, AlertTriangleIcon } from '@shopify/polaris-icons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PrintArea } from '~/types/integration'
import type { Modifier } from '@dnd-kit/core'
import { SortableList } from '~/components/common/SortableList'
import CreateTemplateButton from './CreateTemplateButton'
import ModalEditTemplate from './ModalEditTemplate'
import { getTemplateDimensions, getTemplateTitle } from './utils/generateDefaultTemplateName'
import type { Template } from '~/types/psd'

// Constants
const SCROLL_AMOUNT = 300
const LEFT_BUTTON_GAP_PX = 8

// Modifier to restrict dragging to horizontal axis only
const restrictToHorizontalAxis: Modifier = ({ transform }) => ({
  ...transform,
  y: 0,
})

interface PrintAreasBarDesktopProps {
  printAreas: Array<PrintArea & { id: string }>
  currentPrintAreaId: string
  switchingToPrintAreaId: string | null
  productTitle?: string
  variantTitle?: string
  isPODProduct: boolean
  allPrintAreas: Array<PrintArea>
  activeVariant: any
  editingPrintArea: PrintArea | null
  deletingPrintAreaId: string | null
  temporarySelectedTemplate: {
    template: Template | File | null
    source: 'existing' | 'psd' | ''
    applyTemplateDimensionToPrintArea: boolean
  }
  onSelectPrintArea: (printAreaId: string) => void
  onSortPrintAreas: (sortedPrintAreas: (PrintArea & { id: string })[]) => void
  onEditPrintArea: (printAreaId: string) => void
  onRemovePrintArea: (printAreaId: string) => void
  onSaveEdit: (
    printAreaId: string,
    data: { name: string; width: number; height: number },
    temporarySelectedTemplate?: {
      template: Template | File | null
      source: 'existing' | 'psd' | ''
      applyTemplateDimensionToPrintArea: boolean
    }
  ) => void
  handleSelectTemporaryTemplate: (
    template: Template | File | null,
    source: 'existing' | 'psd' | '',
    applyTemplateDimensionToPrintArea: boolean
  ) => void
  onCloseEditModal: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
  t: (key: string) => string
}

export function PrintAreasBarDesktop(props: PrintAreasBarDesktopProps) {
  const {
    printAreas,
    currentPrintAreaId,
    switchingToPrintAreaId,
    productTitle,
    variantTitle,
    isPODProduct,
    allPrintAreas,
    activeVariant,
    editingPrintArea,
    deletingPrintAreaId,
    temporarySelectedTemplate,
    onSelectPrintArea,
    onSortPrintAreas,
    onEditPrintArea,
    onRemovePrintArea,
    onSaveEdit,
    handleSelectTemporaryTemplate,
    onCloseEditModal,
    onConfirmDelete,
    onCancelDelete,
    t,
  } = props

  const [isEditModalHidden, setIsEditModalHidden] = useState(false)

  // Horizontal scroll controls
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const createButtonRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [leftButtonOffset, setLeftButtonOffset] = useState<number>(4)

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const { scrollLeft, clientWidth, scrollWidth } = el
    // Add small threshold to prevent flickering
    const threshold = 2

    setCanScrollLeft(scrollLeft > threshold)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - threshold)
  }, [])

  const scrollBy = useCallback((dx: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dx, behavior: 'smooth' })
  }, [])

  // Initialize and update arrow states on mount/scroll/resize/content change
  useEffect(() => {
    updateScrollButtons()
    const el = scrollRef.current
    if (!el) return

    // Debounce scroll events to improve performance
    let scrollTimeout: NodeJS.Timeout
    const onScroll = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(updateScrollButtons, 10)
    }

    const onResize = () => updateScrollButtons()

    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      clearTimeout(scrollTimeout)
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [updateScrollButtons])

  useEffect(() => {
    updateScrollButtons()
  }, [printAreas.length, updateScrollButtons])

  // Measure Create template button width to position left floating button precisely
  useEffect(() => {
    const wrapper = createButtonRef.current
    if (!wrapper || isPODProduct) {
      setLeftButtonOffset(4)
      return
    }

    const compute = () => {
      try {
        const width = wrapper.offsetWidth || 0
        setLeftButtonOffset(width + LEFT_BUTTON_GAP_PX)
      } catch {}
    }

    compute()

    let ro: ResizeObserver | null = null
    let resizeHandler: (() => void) | null = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => compute())
      ro.observe(wrapper)
    } else {
      resizeHandler = () => compute()
      window.addEventListener('resize', resizeHandler, { passive: true })
    }

    return () => {
      if (ro) ro.disconnect()
      if (resizeHandler) window.removeEventListener('resize', resizeHandler)
    }
  }, [isPODProduct])

  // Modifiers to restrict dragging to horizontal axis only
  const dragModifiers = useMemo(() => [restrictToHorizontalAxis], [])

  // Reset edit modal visibility and temp template when closing edit modal
  const handleCloseEditModal = useCallback(() => {
    setIsEditModalHidden(false)
    handleSelectTemporaryTemplate(null, '', true)
    onCloseEditModal()
  }, [handleSelectTemporaryTemplate, onCloseEditModal])

  // Handler for when user clicks "Done"
  const handleSaveEdit = useCallback(
    (printAreaId: string, data: { name: string; width: number; height: number }) => {
      // Just pass through to the original handler
      // Template selection is now handled inside ModalEditTemplate
      onSaveEdit(printAreaId, data, temporarySelectedTemplate)

      // Reset temp template after save
      handleSelectTemporaryTemplate(null, '', true)
    },
    [handleSelectTemporaryTemplate, onSaveEdit, temporarySelectedTemplate]
  )

  return (
    <Box
      paddingInlineStart="200"
      paddingInlineEnd="200"
      paddingBlockStart="100"
      paddingBlockEnd="100"
      borderColor="border"
      borderBlockStartWidth="025"
      width="100%"
    >
      <Box width="fit-content" id="print-areas-bar" position="relative" maxWidth="100%">
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          {/* Create Print Area with Template button - Always fixed first */}
          {!isPODProduct && (
            <div ref={createButtonRef} style={{ flexShrink: 0 }}>
              <CreateTemplateButton />
            </div>
          )}

          {/* Scroll left button - Floating right after the Create button */}
          {canScrollLeft && (
            <div
              className="emtlkit--d-flex emtlkit--flex-center"
              style={{
                position: 'absolute',
                left: !isPODProduct ? `${leftButtonOffset}px` : '4px',
                zIndex: 100,
                border: '1px solid var(--p-color-border)',
                background: 'var(--p-color-bg-surface)',
                borderRadius: 'var(--p-border-radius-200)',
                padding: 'var(--p-space-100)',
                boxShadow: '0 0 8px rgba(0,0,0,0.1)',
                height: '80%',
              }}
            >
              <Button
                icon={ChevronLeftIcon}
                variant="monochromePlain"
                onClick={() => scrollBy(-SCROLL_AMOUNT)}
                accessibilityLabel="Scroll left"
              />
            </div>
          )}

          {/* Scroll right button - Absolute positioned at the end */}
          <div
            className="emtlkit--d-flex emtlkit--flex-center"
            style={{
              position: 'absolute',
              right: 4,
              zIndex: 100,
              opacity: canScrollRight ? 1 : 0,
              pointerEvents: canScrollRight ? 'auto' : 'none',
              background: 'var(--p-color-bg-surface)',
              border: '1px solid var(--p-color-border)',
              padding: 'var(--p-space-100)',
              borderRadius: 'var(--p-border-radius-200)',
              boxShadow: canScrollRight ? '0 0 8px rgba(0,0,0,0.1)' : 'none',
              transition: 'opacity 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
              height: '80%',
            }}
          >
            <Button
              icon={ChevronRightIcon}
              variant="monochromePlain"
              onClick={() => scrollBy(SCROLL_AMOUNT)}
              accessibilityLabel="Scroll right"
              disabled={!canScrollRight}
            />
          </div>

          {/* Horizontal Sortable Print Areas */}
          {printAreas.length > 0 && (
            <div
              style={{
                flex: 1,
                minWidth: 0,
                maxWidth: '100%',
                overflow: 'hidden',
              }}
            >
              <div
                className="PrintAreasBar-SortableList"
                ref={scrollRef}
                style={{
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  width: '100%',
                  maxWidth: '100%',
                }}
              >
                <div style={{ display: 'flex', gap: 8, width: 'max-content' }}>
                  <SortableList
                    items={printAreas}
                    direction="horizontal"
                    sortableListOverlayStyle={{ margin: '-16px' }}
                    onChange={onSortPrintAreas}
                    modifiers={dragModifiers}
                    renderItem={printArea => {
                      const isActive = printArea._id === currentPrintAreaId
                      // Use template name directly if exists (source of truth), otherwise use getTemplateTitle for display
                      const template = typeof printArea.template === 'object' ? printArea.template : null
                      const templateName = template?.name || ''
                      const displayTitle = templateName || getTemplateTitle(printArea, productTitle, variantTitle)

                      // Get dimensions from template if exists, otherwise from print area
                      const { width: printAreaWidth, height: printAreaHeight } = getTemplateDimensions(printArea)
                      const isSwitching = switchingToPrintAreaId === printArea._id

                      // Check dimension mismatch for POD products
                      const hasDimensionMismatch
                        = isPODProduct
                        && template
                        && printArea.width
                        && printArea.height
                        && (template.dimension?.width !== printArea.width
                          || template.dimension?.height !== printArea.height)

                      return (
                        <SortableList.Item
                          key={printArea._id}
                          id={printArea._id}
                          styles={{ flexGrow: 'unset', padding: '0' }}
                        >
                          <Box
                            background={isActive ? 'bg-surface-active' : 'bg-surface'}
                            padding="200"
                            borderRadius="200"
                            borderColor={isActive ? 'border-inverse' : 'border'}
                            borderWidth="025"
                            minWidth="200px"
                            maxWidth="280px"
                          >
                            <InlineStack gap="200" blockAlign="center" wrap={false}>
                              {/* Drag handle */}
                              <SortableList.DragHandle />

                              {/* Content - make clickable */}
                              <div
                                onClick={() => onSelectPrintArea(printArea._id)}
                                style={{
                                  cursor: isSwitching ? 'wait' : 'pointer',
                                  flex: 1,
                                  minWidth: 0,
                                  width: '140px',
                                  opacity: isSwitching ? 0.6 : 1,
                                }}
                              >
                                <div style={{ width: '100%' }}>
                                  <Tooltip content={displayTitle}>
                                    <Text as="span" variant="bodySm" fontWeight="medium" truncate>
                                      {displayTitle}
                                    </Text>
                                  </Tooltip>
                                  <Text as="span" variant="bodySm" tone="subdued">
                                    {printAreaWidth} × {printAreaHeight} px
                                  </Text>
                                </div>
                              </div>

                              {/* Actions */}
                              <InlineStack gap="100">
                                {/* Warning icon for dimension mismatch */}
                                {hasDimensionMismatch && (
                                  <Tooltip
                                    content={t(
                                      'template-dimension-does-not-match-print-area-dimension-click-edit-to-review'
                                    )}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      <Icon source={AlertTriangleIcon} tone="warning" />
                                    </div>
                                  </Tooltip>
                                )}
                                {/* Edit button - Always visible */}
                                <Button
                                  icon={EditIcon}
                                  variant="plain"
                                  onClick={() => onEditPrintArea(printArea._id)}
                                  accessibilityLabel="Edit template"
                                />
                                {/* Delete button - Only visible for non-POD products and when more than 1 print area exists */}
                                {!isPODProduct && printAreas.length > 1 && (
                                  <Button
                                    icon={DeleteIcon}
                                    variant="plain"
                                    onClick={() => onRemovePrintArea(printArea._id)}
                                    accessibilityLabel="Remove template and print area"
                                  />
                                )}
                              </InlineStack>
                            </InlineStack>
                          </Box>
                        </SortableList.Item>
                      )
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Template Modal */}
        {!!editingPrintArea && !isEditModalHidden && (
          <ModalEditTemplate
            isPODProduct={isPODProduct}
            active={!!editingPrintArea && !isEditModalHidden}
            onClose={handleCloseEditModal}
            printArea={editingPrintArea}
            allPrintAreas={allPrintAreas}
            productTitle={productTitle}
            variantTitle={variantTitle}
            activeVariant={activeVariant}
            temporarySelectedTemplate={temporarySelectedTemplate}
            onSave={handleSaveEdit}
            handleSelectTemporaryTemplate={(
              template: Template | File | null,
              source: 'existing' | 'psd' | '',
              applyTemplateDimensionToPrintArea?: boolean
            ) => handleSelectTemporaryTemplate(template, source, applyTemplateDimensionToPrintArea ?? true)}
          />
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          open={!!deletingPrintAreaId}
          onClose={onCancelDelete}
          title={t('delete-template')}
          primaryAction={{
            content: t('delete'),
            destructive: true,
            onAction: onConfirmDelete,
          }}
          secondaryActions={[
            {
              content: t('cancel'),
              onAction: onCancelDelete,
            },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="200">
              <Text as="p" variant="bodyMd">
                {t('this-action-can-t-be-undone-and-this-template-won-t-appear-on-your-product')}
              </Text>
            </BlockStack>
          </Modal.Section>
        </Modal>
      </Box>
    </Box>
  )
}
