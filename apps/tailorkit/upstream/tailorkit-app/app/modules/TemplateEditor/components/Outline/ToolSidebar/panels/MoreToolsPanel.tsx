import { Box, Icon, InlineStack, Text } from '@shopify/polaris'
import { FileIcon, PaintBrushFlatIcon, ThemeTemplateIcon, SkeletonIcon } from '@shopify/polaris-icons'
import styles from './styles.module.css'
import { EElementType, TutorialVideoButton } from '../../Header/ButtonAddElements'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ELayerType } from '~/types/psd'
import type { IImageQuery } from '~/types/shopify-files'
import { useElementActions } from '../../../Editor/hooks/useElementActions'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { LayerToolMap, type LayerToolType } from '../../LayerToolbar/constants'
import DropZoneWithCustomPSDFileDialogComponent from '../../Header/DropZonePSDFileComponent'
import VectorEditor from '~/modules/VectorEditor'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'

interface IMoreElement {
  id: string
  labelKey: string
  icon: any
  tutorialId?: EElementType
}

const MORE_ELEMENTS: IMoreElement[] = [
  {
    id: ELayerType.MULTI_LAYOUT,
    labelKey: 'multi-layout',
    icon: ThemeTemplateIcon,
    tutorialId: EElementType.MULTI_LAYOUT,
  },
  {
    id: ELayerType.IMAGELESS,
    labelKey: 'imageless',
    icon: SkeletonIcon,
    tutorialId: EElementType.IMAGELESS,
  },
  {
    id: 'psd-file',
    labelKey: 'psd-file',
    icon: FileIcon,
    tutorialId: EElementType.PSD,
  },
  {
    id: 'draw-shape',
    labelKey: 'Draw shape',
    icon: PaintBrushFlatIcon,
  },
]

export default function MoreToolsPanel(props: { setActiveTool: (tool: LayerToolType | null) => void }) {
  const { setActiveTool } = props
  const { t } = useTranslation()
  const { addElements } = useElementActions()
  const [popoverTutorialIdActive, setPopoverTutorialIdActive] = useState('')
  const [vectorEditorOpen, setVectorEditorOpen] = useState(false)

  const { state, openModal, closeModal } = useModal()

  const openFileDialog = state?.[MODAL_ID.PSD_FILE_SELECTOR_MODAL]?.active

  // Get template dimensions for VectorEditor blank canvas
  const templateDimension = useStore(TemplateEditorStore, state => state.dimension)

  // Get preview product image for VectorEditor environmental background
  const previewProductImage = useStore(TemplateEditorStore, state => state.previewProductImage)

  const togglePopoverTutorialIdActive = useCallback((id?: string) => {
    setPopoverTutorialIdActive(id ?? '')
  }, [])

  const toggleOpenFileDialog = useCallback(() => {
    if (openFileDialog) {
      closeModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL)
    } else {
      openModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL)
    }
  }, [closeModal, openModal, openFileDialog])

  const handleElementClick = (elementId: string) => {
    switch (elementId) {
      case 'psd-file':
        toggleOpenFileDialog()
        break
      case 'draw-shape':
        setVectorEditorOpen(true)
        break
      default:
        addElements(elementId as ELayerType)
        setActiveTool(LayerToolMap.LAYERS_LISTING)
        break
    }
  }

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
      setActiveTool(LayerToolMap.LAYERS_LISTING)
    },
    [addElements, setActiveTool, templateDimension]
  )

  return (
    <Box padding="400">
      <div className={styles.moreElementsGrid}>
        {MORE_ELEMENTS.map(element => (
          <div key={element.id} className={styles.moreElementCard} onClick={() => handleElementClick(element.id)}>
            <div className={styles.moreElementPreview}>
              <Icon source={element.icon} />
            </div>
            <InlineStack gap="050" align="center" blockAlign="center" wrap={false}>
              <Text as="p" variant="bodySm" truncate>
                {t(element.labelKey)}
              </Text>
              <TutorialVideoButton
                type={element.tutorialId as EElementType}
                popoverIdActive={popoverTutorialIdActive}
                setPopoverActive={togglePopoverTutorialIdActive}
              />
            </InlineStack>
          </div>
        ))}
      </div>
      {/* Support components for dialogs/popovers */}
      <DropZoneWithCustomPSDFileDialogComponent togglePopoverActive={() => setActiveTool(null)} />

      {/* VectorEditor for drawing shapes from scratch */}
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
        previewImageConfig={
          previewProductImage && previewProductImage.visible !== false ? previewProductImage : undefined
        }
      />
    </Box>
  )
}
