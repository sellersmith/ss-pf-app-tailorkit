import { Icon, InlineStack, Text, Spinner, Box } from '@shopify/polaris'
import { useMemo, useCallback, useState } from 'react'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { MultipleButtonToggle } from '~/components/Button/MultipleButtonToggle'
import { EDITOR_TABS, type EditorTab } from '../../constants'
import { useEditorParams } from '../../hooks/useEditorParams'
import { EditIcon, SlideshowIcon, ViewIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import useDesignPreview from '../../hooks/useDesignPreview'
import { syncTemplateEditorToIntegration } from '~/stores/modules/integration/fns'
import { setSwitchingToPrintAreaId } from '~/stores/modules/canvas-switching'
import { getExtractedLayerStores } from '~/stores/modules/template'
import { uploadedPreviewStoreActions } from '~/modules/TemplateEditor/components/Preview/stores/uploadedPreviewStore'
import type { TLayerStore } from '~/stores/modules/layer'
import useDevices from '~/utils/hooks/useDevice'
import useWindowSize from '~/utils/hooks/useWindowSize'
import {
  clarityEvent,
  claritySetTag,
  clarityUpgrade,
  clarityStop,
  clarityStart,
  clarityIdentify,
} from '~/bootstrap/hooks/useClarity'
import { useRootLoaderData } from '~/root'

/**
 * Unified tab navigation component for Design/Mockup/Preview modes.
 *
 * On desktop: Design + Mockup only (Preview is always visible in the right panel).
 * On mobile/tablet: Design + Mockup + Preview (original behavior preserved).
 *
 * @returns MultipleButtonToggle component with tab options
 */
export default function DesignMockupPreviewTabs() {
  const { tab, mockupId, printAreaId, setTab: setTabParam } = useEditorParams()
  const { isSmallMobileView } = useDevices()
  const { width: viewportWidth } = useWindowSize()
  const variants = useStore(IntegrationStore, state => state.variants)
  const { captureActiveTemplatePreview } = useDesignPreview()
  const [isCapturing, setIsCapturing] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  // Get shop domain for Clarity re-identification after session restart
  const rootLoaderData = useRootLoaderData()
  const shopDomain = rootLoaderData?.shopData?.shopDomain

  const { t } = useTranslation()

  // Preview tab is shown at all breakpoints below full desktop (1056px+).
  // Full desktop shows preview in the right PreviewPanel — no tab needed.
  const showPreviewTab = viewportWidth < 1056

  // In Product Editor context: check variants for valid templates (needed for Preview tab)
  const activeVariant = useMemo(() => {
    if (!showPreviewTab || !variants || variants.length === 0) return undefined
    return variants.find(v => v.mockup._id === mockupId) || variants[0]
  }, [showPreviewTab, variants, mockupId])

  const hasValidTemplates = useMemo(() => {
    if (!showPreviewTab) return true
    if (!variants || variants.length === 0) return true
    if (!activeVariant) return false
    return activeVariant.printAreas?.some(printArea => !!printArea.template) || false
  }, [showPreviewTab, variants, activeVariant])

  const setTab = useCallback(
    async (next: EditorTab) => {
      const startTime = performance.now()
      setIsSwitching(true)

      try {
        // Capture when LEAVING Design (canvas still mounted)
        if (tab === EDITOR_TABS.DESIGN && next !== EDITOR_TABS.DESIGN && mockupId && printAreaId) {
          setIsCapturing(true)
          setSwitchingToPrintAreaId(printAreaId)

          await new Promise(resolve => requestAnimationFrame(resolve))

          try {
            await captureActiveTemplatePreview(mockupId, printAreaId)
          } catch (error) {
            console.error('[Design Exit Capture] Failed:', error)
          } finally {
            setIsCapturing(false)
          }
        }

        // Sync to integration when switching TO Preview (mobile/tablet only)
        if (next === EDITOR_TABS.PREVIEW && mockupId && printAreaId) {
          await syncTemplateEditorToIntegration({ mockupId, printAreaId })

          // Cache root option sets for all layers before entering Preview tab.
          // This prevents Preview tab changes from persisting to Design tab.
          const extractedLayerStores = getExtractedLayerStores()
          extractedLayerStores?.forEach((layerStore: TLayerStore) => {
            const { _id, optionSet } = layerStore.getState()
            if (optionSet && optionSet.length) {
              uploadedPreviewStoreActions.cacheOptionSet(_id, optionSet)
            }
          })
        }

        // Restore cached option sets when leaving Preview tab
        if (tab === EDITOR_TABS.PREVIEW && next === EDITOR_TABS.DESIGN) {
          const extractedLayerStores = getExtractedLayerStores()
          extractedLayerStores?.forEach((layerStore: TLayerStore) => {
            const { _id } = layerStore.getState()
            uploadedPreviewStoreActions.resetOptionSetForLayer(_id)
          })
        }

        // Ensure minimum 200ms for smooth transition
        const elapsed = performance.now() - startTime
        const remaining = Math.max(0, 200 - elapsed)
        await new Promise(resolve => setTimeout(resolve, remaining))

        // CLARITY SPA HANDLING:
        // Clarity interprets URL changes as page navigation and ends recording.
        // Solution: Stop current recording, change URL, then start new recording.
        if (typeof window !== 'undefined') {
          const clarityExists = typeof window.clarity === 'function'

          if (clarityExists) {
            clarityEvent(`tab-switch-${tab}-to-${next}`)
            claritySetTag('current-tab', next)
            clarityStop()
          }
        }

        // Navigate to new tab (URL change happens here)
        setTabParam(next)

        // Wait for DOM to settle after tab switch
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

        // CLARITY: Start new recording after URL change and DOM settled
        if (typeof window !== 'undefined' && typeof window.clarity === 'function') {
          clarityStart()

          if (shopDomain) {
            const shopName = shopDomain.replace('.myshopify.com', '')
            clarityIdentify(shopDomain, shopName)
          }

          claritySetTag('current-tab', next)
          clarityUpgrade(`recording-${next}-tab`)
        }
      } catch (error) {
        console.error('[Tab Switch] Failed:', error)
        setIsCapturing(false)
      } finally {
        setSwitchingToPrintAreaId(null)
        setIsSwitching(false)
      }
    },
    [tab, mockupId, printAreaId, setTabParam, captureActiveTemplatePreview, shopDomain]
  )

  const handleTabChange = useCallback(
    (values: string[]) => {
      const newTab = values[0] as EditorTab
      if (!newTab || newTab === tab) return
      setTab(newTab)
    },
    [tab, setTab]
  )

  const options = useMemo(
    () => [
      {
        value: EDITOR_TABS.DESIGN,
        label: (
          <InlineStack gap="100" wrap={false}>
            {!isSmallMobileView ? (
              <Box>
                <Icon source={EditIcon} />
              </Box>
            ) : null}
            <Text as="span">{t('editor')}</Text>
          </InlineStack>
        ),
        disabled: isSwitching || isCapturing,
      },
      {
        value: EDITOR_TABS.MOCKUP,
        tooltip: !printAreaId ? t('please-select-a-print-area-at-bottom-side-bar') : undefined,
        label: (
          <Box id="unified-editor-mockup-tab">
            <InlineStack gap="100" wrap={false}>
              {isCapturing && tab !== EDITOR_TABS.MOCKUP && !isSmallMobileView ? (
                <Spinner size="small" />
              ) : !isSmallMobileView ? (
                <Box>
                  {/* Desktop: ViewIcon + "Live preview" | Mobile/tablet: SlideshowIcon + "Mockup" */}
                  <Icon source={showPreviewTab ? SlideshowIcon : ViewIcon} />
                </Box>
              ) : null}
              <Text as="span">{showPreviewTab ? t('mockup') : t('live-preview')}</Text>
            </InlineStack>
          </Box>
        ),
        disabled: isSwitching || isCapturing || !printAreaId,
      },
      // Preview tab — mobile/tablet only (desktop shows preview in the right panel)
      ...(showPreviewTab
        ? [
            {
              value: EDITOR_TABS.PREVIEW,
              tooltip: !printAreaId ? t('please-select-a-print-area-at-bottom-side-bar') : undefined,
              label: (
                <Box id="unified-editor-preview-tab">
                  <InlineStack gap="100" wrap={false}>
                    {!isSmallMobileView ? (
                      <Box>
                        <Icon source={ViewIcon} />{' '}
                      </Box>
                    ) : null}
                    <Text as="span">{t('live-preview')}</Text>
                  </InlineStack>
                </Box>
              ),
              disabled: !hasValidTemplates || isSwitching || isCapturing || !printAreaId,
            },
          ]
        : []),
    ],
    [hasValidTemplates, t, isSwitching, isCapturing, tab, printAreaId, isSmallMobileView, showPreviewTab]
  )

  return <MultipleButtonToggle disableToggle selected={[tab]} options={options} onClick={handleTabChange} />
}
