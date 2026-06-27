import { ActionList, BlockStack, Box, Button, Icon, InlineStack, Popover, Text } from '@shopify/polaris'
import {
  ImageMagicIcon,
  LightbulbIcon,
  MagicIcon,
  PaintBrushFlatIcon,
  PaintBrushRoundIcon,
  PlayIcon,
  PlusIcon,
  QuestionCircleIcon,
  XIcon,
} from '@shopify/polaris-icons'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useTourGuide } from '~/bootstrap/hoc/withTourGuide'
import { ECardPlacement, TRIGGER_ELEMENT } from '~/components/TourGuide/constants'
import styles from '~/components/TourGuide/styles.module.css'
import {
  addTooltipTriangle,
  constrainPositionToViewport,
  getPositionByPlacement,
  getViewportDimension,
} from '~/components/TourGuide/utils/fns'
import { ETutorialVideo } from '~/constants/enum'
import { MODAL_ID } from '~/constants/modal'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import { ELayerType, type LayerType } from '~/types/psd'
import type { IImageQuery } from '~/types/shopify-files'
import { useModal } from '~/utils/hooks/useModal'
import { subInspectorStoreActions } from '~/stores/canvas/subInspector'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import VectorEditor from '~/modules/VectorEditor'
import { useChatBot } from '~/providers/ChatBotContext'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'

interface IButtonAddElementsProps {
  addElements: (type: LayerType, mediaFiles: IImageQuery[] | null) => void
  excludeTypes?: EElementType[]
}

export enum EElementType {
  TEXT = 'text',
  IMAGELESS = 'imageless',
  MULTI_LAYOUT = 'multi-layout',
  IMAGE = 'image',
  AI_IMAGE = 'ai-image',
  PSD = 'psd',
  CLIPART = 'clipart',
  VECTOR = 'vector',
}

const tutorialTooltips = {
  [EElementType.TEXT]: {
    titleKey: 'text',
    descriptionKey: 'text-element-description',
    url: ETutorialVideo.TEXT_ELEMENT,
  },
  [EElementType.IMAGELESS]: {
    titleKey: 'imageless',
    descriptionKey: 'imageless-element-description',
    url: ETutorialVideo.IMAGELESS_ELEMENT,
  },
  [EElementType.MULTI_LAYOUT]: {
    titleKey: 'multi-layout',
    descriptionKey: 'multi-layout-element-description',
    url: ETutorialVideo.MULTI_LAYOUT_ELEMENT,
  },
  [EElementType.IMAGE]: {
    titleKey: 'image',
    descriptionKey: 'image-element-description',
    url: ETutorialVideo.IMAGE_UPLOAD,
  },
  [EElementType.AI_IMAGE]: {
    titleKey: 'ai-image',
    descriptionKey: 'ai-image-element-description',
    url: '',
  },
  [EElementType.PSD]: {
    titleKey: 'psd-file',
    descriptionKey: 'psd-file-element-description',
    url: ETutorialVideo.PSD_FILE_UPLOAD,
  },
  [EElementType.CLIPART]: {
    titleKey: 'clipart',
    descriptionKey: 'clipart-element-description',
    url: ETutorialVideo.CLIPART_SOURCE,
  },
}

export default function ButtonAddElements(props: IButtonAddElementsProps) {
  const { addElements, excludeTypes = [] } = props

  const { t } = useTranslation()
  const { toggleChatBot } = useChatBot()
  const { trackAction } = useFeatureTracking('ai_assistant')
  const [popoverActive, setPopoverActive] = useState(false)
  const [popoverTutorialIdActive, setPopoverTutorialIdActive] = useState('')
  const [vectorEditorOpen, setVectorEditorOpen] = useState(false)
  const { state, openModal, closeModal } = useModal()

  // Get template dimensions for VectorEditor blank canvas
  const templateDimension = useStore(TemplateEditorStore, state => state.dimension)

  const openFileDialog = state?.[MODAL_ID.PSD_FILE_SELECTOR_MODAL]?.active
  const openImagesDialog = state?.[MODAL_ID.IMAGE_SELECTOR_MODAL]?.active
  const openClipartsDialog = state?.[MODAL_ID.CLIPART_SELECTOR_MODAL]?.active

  const togglePopoverActive = useCallback((state?: boolean) => {
    setPopoverActive(popoverActive => state ?? !popoverActive)
    setPopoverTutorialIdActive('')
  }, [])

  const toggleOpenFileDialog = useCallback(() => {
    if (openFileDialog) {
      closeModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL)
    } else {
      openModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL)
    }
  }, [closeModal, openModal, openFileDialog])

  const toggleOpenImagesDialog = useCallback(() => {
    if (openImagesDialog) {
      closeModal(MODAL_ID.IMAGE_SELECTOR_MODAL)
    } else {
      openModal(MODAL_ID.IMAGE_SELECTOR_MODAL)
    }
  }, [closeModal, openModal, openImagesDialog])

  const toggleOpenClipartsDialog = useCallback(() => {
    if (openClipartsDialog) {
      closeModal(MODAL_ID.CLIPART_SELECTOR_MODAL)
    } else {
      openModal(MODAL_ID.CLIPART_SELECTOR_MODAL)
    }
  }, [closeModal, openModal, openClipartsDialog])

  const toggleVectorEditor = useCallback(() => {
    setVectorEditorOpen(prev => !prev)
    togglePopoverActive(false)
  }, [togglePopoverActive])

  const handleVectorSave = useCallback(
    (svgUrl: string, dimensions?: { width: number; height: number }) => {
      // Use actual SVG dimensions if provided, otherwise fall back to template dimensions
      const width = dimensions?.width ?? templateDimension.width
      const height = dimensions?.height ?? templateDimension.height
      const imageData: IImageQuery = {
        id: `vector-${Date.now()}`,
        alt: 'Vector Shape',
        image: {
          originalSrc: svgUrl,
          width,
          height,
        },
      }
      addElements(ELayerType.IMAGE, [imageData])
      setVectorEditorOpen(false)
    },
    [addElements, templateDimension]
  )

  const { tour } = useTourGuide()

  const onClosePopover = useCallback(
    (e?: Event) => {
      // Stop closing the popover if in tour
      tour && e?.stopPropagation()

      if (openImagesDialog) return

      setPopoverActive(false)
    },
    [openImagesDialog, tour]
  )

  const extracting = useStore(TemplateEditorStore, state => state.extracting)

  const activator = (
    <Button
      id="add-elements-btn"
      onClick={() => togglePopoverActive()}
      disclosure={popoverActive ? 'up' : 'down'}
      icon={<Icon source={LightbulbIcon} tone="base" />}
      size="large"
    >
      {t('more')}
    </Button>
  )

  const addTextElement = useCallback(() => {
    addElements(ELayerType.TEXT, null)
    togglePopoverActive()
  }, [addElements, togglePopoverActive])

  const addImagelessElement = useCallback(() => {
    addElements(ELayerType.IMAGELESS, null)
    togglePopoverActive()
  }, [addElements, togglePopoverActive])

  const addMultiLayoutElement = useCallback(() => {
    addElements(ELayerType.MULTI_LAYOUT, null)
    togglePopoverActive()
  }, [addElements, togglePopoverActive])

  return (
    <Fragment>
      {/* @ts-ignore */}
      <Popover active={popoverActive} activator={activator} preventCloseOnChildOverlayClick onClose={onClosePopover}>
        <div id="add-elements-btn-container">
          <ActionList
            actionRole="menuitem"
            sections={(() => {
              const basicItems: any[] = []

              if (excludeTypes.includes(EElementType.TEXT)) {
                basicItems.push({
                  id: 'add-text-btn',
                  content: t('text'),
                  prefix: <Icon source={PlusIcon} tone="base" />,
                  suffix: (
                    <TutorialVideoButton
                      type={EElementType.TEXT}
                      popoverIdActive={popoverTutorialIdActive}
                      setPopoverActive={setPopoverTutorialIdActive}
                    />
                  ),
                  onAction: addTextElement,
                })
              }

              if (excludeTypes.includes(EElementType.IMAGE)) {
                basicItems.push({
                  id: 'add-image-btn',
                  content: t('image'),
                  prefix: <Icon source={PlusIcon} tone="base" />,
                  onAction: toggleOpenImagesDialog,
                })
              }

              if (excludeTypes.includes(EElementType.CLIPART)) {
                basicItems.push({
                  id: 'add-clipart-btn',
                  content: t('clipart'),
                  prefix: <Icon source={PaintBrushRoundIcon} tone="base" />,
                  onAction: toggleOpenClipartsDialog,
                })
              }

              if (excludeTypes.includes(EElementType.AI_IMAGE)) {
                basicItems.push({
                  id: 'add-ai-image-btn',
                  content: (
                    <Text variant="bodySm" as="span" tone="success">
                      {t('ai-image')}
                    </Text>
                  ),
                  prefix: <Icon source={ImageMagicIcon} tone="success" />,
                  onAction: () => {
                    // Clear the selection
                    LayerStoreSelection.dispatch({
                      type: 'SET_LAYER_STORE_SELECTION',
                      payload: { clickedLayerStore: null, checkedLayerStores: [] },
                    })

                    subInspectorStoreActions.openSubInspector('ai-image-inspector', {
                      title: t('generate-images'),
                    })
                  },
                })
              }

              // if (!excludeTypes.includes(EElementType.IMAGELESS)) {
              basicItems.push({
                id: 'add-imageless-btn',
                content: t('imageless'),
                prefix: <Icon source={PlusIcon} tone="base" />,
                suffix: (
                  <TutorialVideoButton
                    type={EElementType.IMAGELESS}
                    popoverIdActive={popoverTutorialIdActive}
                    setPopoverActive={setPopoverTutorialIdActive}
                  />
                ),
                onAction: addImagelessElement,
              })
              // }

              // if (!excludeTypes.includes(EElementType.MULTI_LAYOUT)) {
              basicItems.push({
                id: 'add-multi-layout-btn',
                content: t('multi-layout'),
                prefix: <Icon source={PlusIcon} tone="base" />,
                suffix: (
                  <TutorialVideoButton
                    type={EElementType.MULTI_LAYOUT}
                    popoverIdActive={popoverTutorialIdActive}
                    setPopoverActive={setPopoverTutorialIdActive}
                  />
                ),
                onAction: addMultiLayoutElement,
              })
              // }

              // Draw Shape button - opens VectorEditor with blank canvas
              basicItems.push({
                id: 'add-vector-btn',
                content: t('draw-shape'),
                prefix: <Icon source={PaintBrushFlatIcon} tone="base" />,
                onAction: toggleVectorEditor,
              })

              const sectionsArr: any[] = [
                {
                  items: [
                    {
                      id: 'add-with-elva-btn',
                      content: (
                        <Text variant="bodySm" as="span" tone="magic">
                          {t('generate-with-ai')}
                        </Text>
                      ),
                      prefix: <Icon source={MagicIcon} tone="magic" />,
                      onAction: () => {
                        trackAction('elva_ai_clicked', { source: 'more_popover' })
                        toggleChatBot(true)
                        togglePopoverActive(false)
                      },
                    },
                  ],
                },
              ]
              if (basicItems.length > 0) {
                sectionsArr.push({ items: basicItems })
              }
              return sectionsArr
            })().concat([
              {
                // title: t('upload'),
                items: [
                  {
                    id: 'add-psd-file-btn',
                    content: t('psd-file'),
                    icon: PlusIcon,
                    disabled: extracting,
                    suffix: (
                      <TutorialVideoButton
                        type={EElementType.PSD}
                        popoverIdActive={popoverTutorialIdActive}
                        setPopoverActive={setPopoverTutorialIdActive}
                      />
                    ),
                    onAction: toggleOpenFileDialog,
                  },
                ],
              },
            ])}
          />
        </div>
      </Popover>
      {/* Hidden activator to help tour guide to trigger the next step */}
      <div style={{ display: 'none' }}>
        <Button
          id="add-elements-btn-container__hidden"
          role={TRIGGER_ELEMENT}
          onClick={togglePopoverActive}
          icon={<Icon source={PlusIcon} tone="base" />}
        />
      </div>

      {/* VectorEditor modal for creating SVG from scratch */}
      <VectorEditor
        isModal={true}
        modalOpen={vectorEditorOpen}
        modalTitle={t('draw-shape')}
        onModalClose={() => setVectorEditorOpen(false)}
        allowBlankCanvas={true}
        initialDimensions={templateDimension}
        initialMode="draw"
        onSave={handleVectorSave}
        uploadToShopify={true}
      />
    </Fragment>
  )
}

export function TutorialVideoButton(props: {
  type: EElementType
  popoverIdActive: string
  setPopoverActive: (state: string) => void
}) {
  const { type, popoverIdActive, setPopoverActive } = props
  const { t } = useTranslation()
  const cardRef = useRef<HTMLDivElement>(null)
  const buttonId = `tutorial-btn-${type}`
  const popoverActive = buttonId === popoverIdActive

  const { titleKey, descriptionKey, url } = tutorialTooltips[type] || {}

  const togglePopoverActive = useCallback(() => {
    try {
      const cardElement = cardRef.current
      const buttonElement = document.getElementById(buttonId)

      if (!cardElement || !buttonElement) return

      // Get the bounding rectangles
      const targetRect = buttonElement.getBoundingClientRect()
      const cardRect = cardElement.getBoundingClientRect()

      // Get viewport dimensions
      const viewport = getViewportDimension()

      // Get initial position based on placement
      const initialPosition = getPositionByPlacement(
        ECardPlacement.RIGHT_TOP,
        targetRect,
        cardRect,
        8 // spacing between button and card
      )

      // Constrain position to viewport
      const constrainedPosition = constrainPositionToViewport(initialPosition, cardRect, viewport)

      // Apply position to card
      Object.assign(cardElement.style, {
        top: typeof constrainedPosition.top === 'number' ? `${constrainedPosition.top - 10}px` : '',
        left: typeof constrainedPosition.left === 'number' ? `${constrainedPosition.left + 12}px` : '',
      })

      // Remove existing tooltip triangle (local container first, then global fallback)
      const localContainer = cardElement.closest('#add-elements-btn-container')
      ;(localContainer ?? document).querySelector('.tooltip-triangle')?.remove()

      // Add tooltip triangle
      !popoverActive && addTooltipTriangle(cardElement, ECardPlacement.RIGHT_TOP, cardRect, '#fff')
    } catch (error) {
      console.error('Error positioning tutorial card:', error)
    }
    setPopoverActive(!popoverActive ? buttonId : '')
  }, [buttonId, setPopoverActive, popoverActive])

  const handlePopoverClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Close on outside click or Escape
  useEffect(() => {
    if (!popoverActive) return

    const handlePointerDown = (event: MouseEvent | TouchEvent | PointerEvent) => {
      const target = event.target as Node | null
      const cardElement = cardRef.current
      const buttonElement = document.getElementById(buttonId)

      if (!target) return
      if (cardElement && cardElement.contains(target)) return
      if (buttonElement && buttonElement.contains(target)) return

      setPopoverActive('')
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [popoverActive, buttonId, setPopoverActive])

  const activator = (
    <InlineStack blockAlign="center">
      <Button
        id={buttonId}
        variant="monochromePlain"
        icon={QuestionCircleIcon}
        onClick={(e?: Event) => {
          e?.stopPropagation()
          togglePopoverActive()
        }}
      />
    </InlineStack>
  )

  if (!t(titleKey) && !t(descriptionKey)) {
    return null
  }

  return (
    <div style={{ position: 'relative' }}>
      {activator}

      {typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={cardRef}
              onClick={handlePopoverClick}
              className={styles.tutorialCard}
              style={{
                position: 'fixed',
                zIndex: 10000,
                maxWidth: '288px',
                background: '#fff',
                borderRadius: '8px',
                boxShadow: '0px 4px 16px 0px rgba(0, 0, 0, 0.1)',
              }}
            >
              {popoverActive && (
                <Box padding="300">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingMd">
                        {t(titleKey)}
                      </Text>
                      <Button
                        variant="plain"
                        icon={XIcon}
                        onClick={togglePopoverActive}
                        accessibilityLabel={t('close')}
                      />
                    </InlineStack>

                    <Text as="p" variant="bodyMd">
                      {t(descriptionKey)}
                    </Text>

                    {url && (
                      <Button onClick={() => window.open(url, '_blank')} icon={PlayIcon}>
                        {t('watch-tutorial')}
                      </Button>
                    )}
                  </BlockStack>
                </Box>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
