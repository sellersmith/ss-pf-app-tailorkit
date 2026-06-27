import type { IconSource } from '@shopify/polaris'
import { BlockStack, Box, Collapsible, Icon, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { useCallback, useRef, useState } from 'react'
import {
  ChartLineIcon,
  ColorIcon,
  FileIcon,
  HeartIcon,
  ImageIcon,
  ImageMagicIcon,
  ListBulletedIcon,
  PaintBrushFlatIcon,
  SlideshowIcon,
  SunIcon,
  TextFontIcon,
  TextFontListIcon,
  TextIcon,
  TextInColumnsIcon,
  TextTitleIcon,
  ThemeTemplateIcon,
  WandIcon,
  MagicIcon,
} from '@shopify/polaris-icons'
import ElementCard from './components/ElementCard'
import VideoModal from '~/components/VideoTutorial/VideoModal'
import { useModal } from '~/utils/hooks/useModal'
import { MODAL_ID } from '~/constants/modal'
import { getEmbedUrl } from '~/utils/getEmbedUrl'
import { ELink } from '~/constants/enum'
import { useLiveChat } from '~/utils/hooks/useLiveChat'
import { useElementActions } from '../../../Editor/hooks/useElementActions'
import { ELayerType } from '~/types/psd'
import { LayerToolMap } from '../../LayerToolbar/constants'
import type { LayerToolType } from '../../LayerToolbar/constants'
import DropZoneWithCustomPSDFileDialogComponent from '../../Header/DropZonePSDFileComponent'
import VectorEditor from '~/modules/VectorEditor'
import { fontLoader } from '~/modules/TemplateEditor/elements/components/Text/instances'
import { fetchCustomFontAsBase64 } from 'extensions/tailorkit-src/src/shared/libraries/svg/svg-font-manager'
import { useStore } from '~/libs/external-store'
import { TemplateEditorStore } from '~/stores/modules/template'
import type { IImageQuery } from '~/types/shopify-files'
import type { getClickedLayerStore } from '~/stores/modules/layer-store-selection'
import { LayerStoreSelection } from '~/stores/modules/layer-store-selection'
import type { ImagePresetResult, PostAction, TextPresetResult } from '../../../Editor/utils/element-presets/types'
import {
  applyTextInputPreset,
  applyTextOptionsPreset,
  applyEngravingPreset,
  applyCurveCirclePreset,
  applyNeonPreset,
  applyFontColorPreset,
  applyFontFamilyPreset,
} from '../../../Editor/utils/element-presets/text-presets'
import {
  getImageUploadPreset,
  getImageOptionsPreset,
  getAIEffectsBuyersPreset,
  getAIEffectsSellersPreset,
  getImageShapesPreset,
} from '../../../Editor/utils/element-presets/image-presets'
import { setPendingImagePostAddActions } from './stores/pending-image-actions-store'
import { applyPersonalizationActions } from './utils/apply-personalization-actions'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { useChatBot } from '~/providers/ChatBotContext'
import styles from './elements-tool-panel.module.css'

interface ElementCardConfig {
  id: string
  label: string
  icon: IconSource
  iconTone?: 'success'
}

interface ElementsToolPanelProps {
  setActiveTool: (tool: LayerToolType | null) => void
}

const TEXT_CARDS: ElementCardConfig[] = [
  { id: 'text-input', label: 'Text input', icon: TextIcon },
  { id: 'text-options', label: 'Text options', icon: ListBulletedIcon },
  { id: 'engraving-text', label: 'Engraving text', icon: TextTitleIcon },
  { id: 'curve-circle-text', label: 'Curve or circle text', icon: ChartLineIcon },
  { id: 'neon-text', label: 'Neon text', icon: SunIcon },
  { id: 'font-color-options', label: 'Font color options', icon: ColorIcon },
  { id: 'font-family-options', label: 'Font family options', icon: TextFontIcon },
  { id: 'font-combination', label: 'Font combination', icon: TextFontListIcon },
]

const IMAGE_CARDS: ElementCardConfig[] = [
  { id: 'image-upload', label: 'Image upload', icon: ImageIcon },
  { id: 'image-options', label: 'Image options', icon: SlideshowIcon },
  { id: 'ai-effects-buyers', label: 'AI effects for buyers', icon: WandIcon, iconTone: 'success' },
  { id: 'ai-effects-sellers', label: 'AI effects for sellers', icon: ImageMagicIcon, iconTone: 'success' },
  { id: 'image-shapes', label: 'Image shapes', icon: HeartIcon },
]

const OTHERS_CARDS: ElementCardConfig[] = [
  { id: 'multilayout', label: 'Multilayout', icon: ThemeTemplateIcon },
  { id: 'imageless', label: 'Imageless', icon: TextInColumnsIcon },
  { id: 'psd-file', label: 'PSD file', icon: FileIcon },
  { id: 'draw-shape', label: 'Draw shape', icon: PaintBrushFlatIcon },
]

const SUB_INSPECTOR_KEY_MAP: Record<string, string> = {
  'open-personalize-text': 'personalize-text-inspector',
  'open-personalize-color': 'personalize-color-inspector',
  'open-personalize-font': 'personalize-font-inspector',
  'open-personalize-image': 'personalize-image-inspector',
  'open-personalize-mask': 'personalize-mask-inspector',
}

const TEXT_PRESET_MAP: Record<string, () => TextPresetResult> = {
  'text-input': applyTextInputPreset,
  'text-options': applyTextOptionsPreset,
  'engraving-text': applyEngravingPreset,
  'curve-circle-text': applyCurveCirclePreset,
  'neon-text': applyNeonPreset,
  'font-color-options': applyFontColorPreset,
  'font-family-options': applyFontFamilyPreset,
}

/**
 * ElementsToolPanel — displays 16 element cards across 3 categories (Text, Image, Others).
 */
export default function ElementsToolPanel({ setActiveTool }: ElementsToolPanelProps) {
  const { t } = useTranslation()
  const { trackAction } = useFeatureTracking('elements_panel')
  const { openModal, closeModal, state } = useModal()
  const { openChatBotAndSendUserMessage } = useLiveChat()
  const { addElements } = useElementActions()
  const { toggleChatBot } = useChatBot()
  const [vectorEditorOpen, setVectorEditorOpen] = useState(false)

  // Collapsible section states: Text expanded by default, Image & Others collapsed
  const [sectionsOpen, setSectionsOpen] = useState({ text: true, image: false, others: false })
  const sectionRefs = useRef<Record<string, HTMLButtonElement | null>>({ text: null, image: null, others: null })
  const toggleSection = useCallback((section: 'text' | 'image' | 'others') => {
    setSectionsOpen(prev => {
      const willOpen = !prev[section]
      // Auto-scroll to section header after Collapsible animation starts
      if (willOpen) {
        setTimeout(() => {
          sectionRefs.current[section]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
      }
      return { ...prev, [section]: willOpen }
    })
  }, [])

  // Get template dimensions for VectorEditor blank canvas
  const templateDimension = useStore(TemplateEditorStore, s => s.dimension)

  // Get preview product image for VectorEditor environmental background
  const previewProductImage = useStore(TemplateEditorStore, s => s.previewProductImage)

  const openFileDialog = state?.[MODAL_ID.PSD_FILE_SELECTOR_MODAL]?.active

  const handleWatchTutorial = useCallback(() => {
    openModal(MODAL_ID.ELEMENTS_TUTORIAL_VIDEO_MODAL)
  }, [openModal])

  const handleContactUs = useCallback(() => {
    openChatBotAndSendUserMessage("I'd like you to guide me on how to add elements.")
  }, [openChatBotAndSendUserMessage])

  const toggleOpenFileDialog = useCallback(() => {
    if (openFileDialog) {
      closeModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL)
    } else {
      openModal(MODAL_ID.PSD_FILE_SELECTOR_MODAL)
    }
  }, [closeModal, openModal, openFileDialog])

  // -------------------------------------------------------------------------
  // Post-action helpers: apply personalization settings to a layer store
  // -------------------------------------------------------------------------

  /**
   * Apply personalization settings from postActions to a given layer store.
   * Does NOT open any inspector panel — purely applies settings.
   */
  const applyPersonalizationToStore = useCallback(
    (layerStore: ReturnType<typeof getClickedLayerStore>, postActions: PostAction[]) => {
      applyPersonalizationActions(layerStore, postActions)
    },
    []
  )

  /**
   * Execute post-actions: apply settings to the newly created layer store + open inspector panel.
   * Uses direct store reference from extractedLayerStores[0] (synchronous after addElements)
   * to avoid timing races with setActiveTool → clearAllSelectedLayerStores.
   */
  const executePostActions = useCallback(
    (postActions: PostAction[]) => {
      if (postActions.length === 0) return

      // Get the newly created layer store directly — addElements prepends at index 0 synchronously.
      const newLayerStore = TemplateEditorStore.getState().extractedLayerStores[0]
      if (newLayerStore) {
        applyPersonalizationToStore(newLayerStore, postActions)
      }

      // Pre-set accordion tab via localStorage before switching tools.
      // AccordionList reads localStorage on mount, so the correct tab opens when inspector renders.
      const firstAction = postActions[0]
      const subInspectorKey = SUB_INSPECTOR_KEY_MAP[firstAction.type]
      if (subInspectorKey) {
        try {
          localStorage.setItem('accordion_group_text-inspector_open_id', JSON.stringify(subInspectorKey))
        } catch {
          /* ignore */
        }
      }

      setActiveTool(LayerToolMap.LAYERS_LISTING)
    },
    [setActiveTool, applyPersonalizationToStore]
  )

  // -------------------------------------------------------------------------
  // Text card handlers
  // -------------------------------------------------------------------------

  const handleTextCardClick = useCallback(
    async (cardId: string) => {
      // Font combination card navigates to a dedicated panel instead of creating an element
      if (cardId === 'font-combination') {
        trackAction('preset_clicked', { preset_type: 'text', preset_id: cardId })
        setActiveTool(LayerToolMap.FONT_COMBINATION)
        return
      }

      const presetFn = TEXT_PRESET_MAP[cardId]
      if (!presetFn) return
      trackAction('preset_clicked', { preset_type: 'text', preset_id: cardId })

      const result = presetFn()
      const isMultiElement = result.elements.length > 1

      // Pre-load fonts AND cache base64 CSS before creating elements.
      // This ensures the canvas SVG renderer has the font ready on first render,
      // avoiding the fallback-font flash that occurs when font loading is async.
      await Promise.allSettled(
        result.elements.map(async el => {
          const ff = el.settings.fontFamily
          if (ff?.family && ff?.src) {
            try {
              await fontLoader.loadFont(ff.family, ff.src)
              await fetchCustomFontAsBase64(ff.src, ff.family)
            } catch (err) {
              console.warn(`Font pre-load failed for ${ff.family}:`, err)
            }
          }
        })
      )

      // Pre-set which accordion tab to open for presets that target a specific tab.
      // The AccordionList reads from localStorage on mount, so setting this before
      // element creation ensures the correct tab is open when the inspector renders.
      const ACCORDION_STORAGE_KEY = 'accordion_group_text-inspector_open_id'
      if (cardId === 'font-color-options') {
        try {
          localStorage.setItem(ACCORDION_STORAGE_KEY, JSON.stringify('personalize-color-inspector'))
        } catch {
          /* ignore */
        }
      } else if (cardId === 'font-family-options') {
        try {
          localStorage.setItem(ACCORDION_STORAGE_KEY, JSON.stringify('personalize-font-inspector'))
        } catch {
          /* ignore */
        }
      }

      // Create all elements. For multi-element presets, disable auto-select
      // so we can manually select the first element.
      result.elements.forEach(el => {
        addElements(ELayerType.TEXT, null, undefined, el.settings, {
          autoSelect: !isMultiElement,
        })
      })

      if (isMultiElement) {
        // Reposition elements to avoid overlapping on canvas
        const allStores = TemplateEditorStore.getState().extractedLayerStores
        // Newly created stores are prepended in reverse order (last created = index 0)
        const newStores = allStores.slice(0, result.elements.length).reverse()
        const canvasHeight = TemplateEditorStore.getState().dimension?.height || 1000

        // Position elements centered on canvas with ~30px gap between them
        const GAP = 30
        const heights = newStores.map(s => s.getState().height || 100)
        const totalHeight = heights.reduce((sum, h) => sum + h, 0) + GAP * (newStores.length - 1)
        let currentTop = Math.round((canvasHeight - totalHeight) / 2)

        newStores.forEach((store, index) => {
          store.dispatch({ type: 'UPDATE_LAYER', payload: { state: { top: currentTop } } })
          currentTop += heights[index] + GAP
        })

        // Apply personalization settings to ALL stores
        newStores.forEach((store, index) => {
          const elementPostActions = result.elements[index]?.postActions || []
          if (elementPostActions.length > 0) {
            applyPersonalizationToStore(store, elementPostActions)
          }
        })

        // Select the FIRST element (text 1)
        setTimeout(() => {
          LayerStoreSelection.dispatch({
            type: 'SET_LAYER_STORE_SELECTION',
            payload: { clickedLayerStore: newStores[0] },
          })
        }, 100)

        // Open Personalize text tab for engraving/curve presets
        try {
          localStorage.setItem(ACCORDION_STORAGE_KEY, JSON.stringify('personalize-text-inspector'))
        } catch {
          /* ignore */
        }
        setActiveTool(LayerToolMap.LAYERS_LISTING)
      } else {
        // Single element: auto-select handled by addElements
        const postActions = result.elements[0]?.postActions || []

        if (cardId === 'neon-text') {
          // Neon: apply personalization settings, open Personalize text tab
          if (postActions.length > 0) {
            const newLayerStore = TemplateEditorStore.getState().extractedLayerStores[0]
            if (newLayerStore) applyPersonalizationToStore(newLayerStore, postActions)

            try {
              localStorage.setItem(ACCORDION_STORAGE_KEY, JSON.stringify('personalize-text-inspector'))
            } catch {
              /* ignore */
            }
            setActiveTool(LayerToolMap.LAYERS_LISTING)
          }
        } else if (cardId === 'font-family-options' || cardId === 'font-color-options') {
          // Apply all settings synchronously. The correct accordion tab is already pre-set
          // via localStorage above, so only personalize-color/font tab will be open.
          if (postActions.length > 0) {
            const newLayerStore = TemplateEditorStore.getState().extractedLayerStores[0]
            if (newLayerStore) applyPersonalizationToStore(newLayerStore, postActions)
            setActiveTool(LayerToolMap.LAYERS_LISTING)
          }
        } else if (postActions.length > 0) {
          executePostActions(postActions)
        }
      }
    },
    [addElements, executePostActions, applyPersonalizationToStore, setActiveTool, trackAction]
  )

  // -------------------------------------------------------------------------
  // Image card handlers
  // -------------------------------------------------------------------------

  const handleImageCardClick = useCallback(
    (cardId: string) => {
      const openImagePanel = (result: ImagePresetResult, accordionTabId?: string) => {
        // Store pending post-add actions to apply after user adds an image
        setPendingImagePostAddActions(result.postAddActions || null)

        // Pre-set which accordion tab to open in the Image inspector.
        // The AccordionList reads from localStorage on mount, so setting this before
        // the Image element inspector renders ensures the correct tab is open.
        if (accordionTabId) {
          try {
            localStorage.setItem('accordion_group_image-inspector_open_id', JSON.stringify(accordionTabId))
          } catch {
            /* ignore */
          }
        }

        // Navigate to the Image or AI Image panel (registered as hidden tools in LAYER_TOOLS)
        const toolId = result.panel === 'ai-image' ? LayerToolMap.AI_IMAGE : LayerToolMap.IMAGE
        setActiveTool(toolId)
      }

      trackAction('preset_clicked', { preset_type: 'image', preset_id: cardId })

      switch (cardId) {
        case 'image-upload': {
          openImagePanel(getImageUploadPreset(), 'personalize-image-inspector')
          break
        }
        case 'image-options': {
          openImagePanel(getImageOptionsPreset(), 'personalize-image-inspector')
          break
        }
        case 'ai-effects-buyers': {
          openImagePanel(getAIEffectsBuyersPreset(), 'personalize-image-inspector')
          break
        }
        case 'ai-effects-sellers': {
          openImagePanel(getAIEffectsSellersPreset(), 'personalize-image-inspector')
          break
        }
        case 'image-shapes': {
          openImagePanel(getImageShapesPreset(), 'personalize-mask-inspector')
          break
        }
        default:
          break
      }
    },
    [setActiveTool, trackAction]
  )

  // -------------------------------------------------------------------------
  // Others card handlers (mirrors MoreToolsPanel logic)
  // -------------------------------------------------------------------------

  const handleOthersCardClick = useCallback(
    (cardId: string) => {
      trackAction('preset_clicked', { preset_type: 'others', preset_id: cardId })

      switch (cardId) {
        case 'psd-file':
          toggleOpenFileDialog()
          break
        case 'draw-shape':
          setVectorEditorOpen(true)
          break
        case 'multilayout':
          addElements(ELayerType.MULTI_LAYOUT)
          setActiveTool(LayerToolMap.LAYERS_LISTING)
          break
        case 'imageless':
          addElements(ELayerType.IMAGELESS)
          setActiveTool(LayerToolMap.LAYERS_LISTING)
          break
        default:
          break
      }
    },
    [addElements, setActiveTool, toggleOpenFileDialog, trackAction]
  )

  const handleVectorSave = useCallback(
    (svgUrl: string, dimensions?: { width: number; height: number }) => {
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

  const renderCards = (cards: ElementCardConfig[], onCardClick: (id: string) => void) => (
    <div className={styles.cardGrid}>
      {cards.map(card => (
        <ElementCard
          key={card.id}
          id={card.id}
          icon={card.icon}
          label={t(card.label)}
          iconTone={card.iconTone}
          onClick={() => onCardClick(card.id)}
        />
      ))}
    </div>
  )

  return (
    <Box padding="400">
      <BlockStack gap="400">
        {/* Elva AI quick-add banner */}
        <button
          className={styles.elvaBanner}
          onClick={() => {
            trackAction('elva_ai_clicked', { source: 'elements_panel' })
            toggleChatBot(true)
          }}
          type="button"
        >
          <span className={styles.elvaBannerIcon}>
            <Icon source={MagicIcon} tone="magic" />
          </span>
          <span className={styles.elvaBannerText}>
            <strong>{t('generate-with-ai')}</strong>
            <span>{t('describe-what-you-need')}</span>
          </span>
        </button>

        {/* Header description */}
        <Text as="p" variant="bodyMd" tone="subdued">
          {t('add-elements-to-start-personalizing')}{' '}
          <button className={styles.linkButton} onClick={handleWatchTutorial} type="button">
            {t('watch-tutorial')}
          </button>{' '}
          {t('or')}{' '}
          <button className={styles.linkButton} onClick={handleContactUs} type="button">
            {t('contact-us')}
          </button>{' '}
          {t('for-detailed-guidance')}
        </Text>

        {/* Text section — expanded by default */}
        <BlockStack gap="200">
          <button
            ref={el => {
              sectionRefs.current.text = el
            }}
            className={styles.sectionHeader}
            onClick={() => toggleSection('text')}
            type="button"
            aria-expanded={sectionsOpen.text}
            aria-controls="elements-text-section"
          >
            <span className={styles.sectionTitle}>{t('text')}</span>
            <span className={styles.sectionChevron} data-open={sectionsOpen.text} />
          </button>
          <Collapsible open={sectionsOpen.text} id="elements-text-section">
            {renderCards(TEXT_CARDS, handleTextCardClick)}
          </Collapsible>
        </BlockStack>

        {/* Image section — collapsed by default */}
        <BlockStack gap="200">
          <button
            ref={el => {
              sectionRefs.current.image = el
            }}
            className={styles.sectionHeader}
            onClick={() => toggleSection('image')}
            type="button"
            aria-expanded={sectionsOpen.image}
            aria-controls="elements-image-section"
          >
            <span className={styles.sectionTitle}>{t('image')}</span>
            <span className={styles.sectionChevron} data-open={sectionsOpen.image} />
          </button>
          <Collapsible open={sectionsOpen.image} id="elements-image-section">
            {renderCards(IMAGE_CARDS, handleImageCardClick)}
          </Collapsible>
        </BlockStack>

        {/* Others section — collapsed by default */}
        <BlockStack gap="200">
          <button
            ref={el => {
              sectionRefs.current.others = el
            }}
            className={styles.sectionHeader}
            onClick={() => toggleSection('others')}
            type="button"
            aria-expanded={sectionsOpen.others}
            aria-controls="elements-others-section"
          >
            <span className={styles.sectionTitle}>{t('other-elements')}</span>
            <span className={styles.sectionChevron} data-open={sectionsOpen.others} />
          </button>
          <Collapsible open={sectionsOpen.others} id="elements-others-section">
            {renderCards(OTHERS_CARDS, handleOthersCardClick)}
          </Collapsible>
        </BlockStack>
      </BlockStack>

      {/* Tutorial video modal */}
      <VideoModal id={MODAL_ID.ELEMENTS_TUTORIAL_VIDEO_MODAL} maximumWidth={720} minimumWidth={300}>
        <iframe
          width="100%"
          style={{ aspectRatio: '16/9' }}
          src={getEmbedUrl(ELink.TUTORIAL_ELEMENTS_YOUTUBE)}
          title="Elements Tutorial Video"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture,fullscreen"
          allowFullScreen={true}
          loading="lazy"
          frameBorder="0"
        />
      </VideoModal>

      {/* Support components for PSD and VectorEditor */}
      <DropZoneWithCustomPSDFileDialogComponent togglePopoverActive={() => setActiveTool(null)} />

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
