import type { TabProps } from '@shopify/polaris'
import { Bleed, BlockStack, Box, Button, Icon, InlineStack, Tabs, Text } from '@shopify/polaris'
import { MagicIcon, WandIcon } from '@shopify/polaris-icons'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FlexCenter } from '~/components/common/Flex'
import { useStore } from '~/libs/external-store'
import withMockup, { type WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'
import AIMockup from '../../../ProductBaseSetting/AIMockup'
import BackgroundImageUploader from '../../../ProductBaseSetting/BackgroundImage'
import BaseImageUploader from '../../../ProductBaseSetting/BaseImage'
import ClippingMaskEnabler from '../../../ProductBaseSetting/ClippingMaskEnabler'
import MaskLayerUploader from '../../../ProductBaseSetting/MaskLayer'
import MockupLayersManager from '../MockupLayersManager'
import AddMockupViewButton from './components/AddMockupViewButton'
import MockupViewLabelOnStorefront from './components/MockupViewLabelOnStorefront'
import ViewTitle from './components/ViewTitle'
import { MODAL_ID } from '~/constants/modal'
import VideoModal from '~/components/VideoTutorial/VideoModal'
import { getEmbedUrl } from '~/utils/getEmbedUrl'
import { useModal } from '~/utils/hooks/useModal'
import FeatureHelpBanner from '~/modules/TemplateEditor/components/FeatureHelpBanner'

const MOCKUP_TUTORIAL_VIDEO_URL = 'https://www.youtube.com/watch?v=cMziHL54Yio'
const MOCKUP_TUTORIAL_VIDEO_MODAL = `${MODAL_ID.EDITOR_TUTORIAL_VIDEO_MODAL}-mockup-tutorial`

function MockupViewsManager(props: WithVariantsProps) {
  const { variants, mockupId } = props
  const { t } = useTranslation()
  const { openModal } = useModal()
  const handleOpenTutorial = useCallback(() => openModal(MOCKUP_TUTORIAL_VIDEO_MODAL), [openModal])

  const rawViews = useStore(IntegrationStore, s => s.variants.find(v => v.mockup._id === mockupId)?.mockup?.views)
  const views = useMemo(() => (Array.isArray(rawViews) ? rawViews : []), [rawViews])
  const isDisabledDeleteView = useMemo(() => views.length === 1, [views])

  const items = useMemo(() => (Array.isArray(views) ? views : []), [views])
  const selectedViewIdStore = useStore(
    IntegrationStore,
    s => s.variants.find(v => v.mockup._id === mockupId)?.mockup?.selectedViewId
  )
  const [expandedViewId, setExpandedViewId] = useState<string | undefined>(selectedViewIdStore)
  const [selectedTab, setSelectedTab] = useState(0)

  const onDeleteView = (viewId: string) => {
    if (isDisabledDeleteView) {
      return
    }
    IntegrationStore.dispatch({ type: 'DELETE_VIEW', payload: { mockupId, viewId } })
  }

  useEffect(() => {
    if (selectedViewIdStore) setExpandedViewId(selectedViewIdStore)
  }, [selectedViewIdStore])

  // Reset tab selection when expanded view changes
  useEffect(() => {
    setSelectedTab(0)
  }, [expandedViewId])

  const handleTabChange = useCallback((selectedTabIndex: number) => setSelectedTab(selectedTabIndex), [])

  const tabs: TabProps[] = useMemo(
    () => [
      {
        id: 'settings',
        content: t('settings'),
        panelID: 'mockup-panel',
      },
      {
        id: 'ai-mockup',
        icon: (
          <FlexCenter gap="4px">
            <Icon tone="success" source={MagicIcon} />
            <Text variant="bodyMd" as="span" tone="success" fontWeight="medium">
              {t('ai-mockup')}
            </Text>
          </FlexCenter>
        ),
        content: '',
        panelID: 'ai-mockup-panel',
      },
      {
        id: 'mask',
        icon: (
          <FlexCenter gap="4px">
            <Icon tone="success" source={WandIcon} />
            <Text variant="bodyMd" as="span" tone="success" fontWeight="medium">
              {t('mask')}
            </Text>
          </FlexCenter>
        ),
        content: '',
        panelID: 'mask-panel',
      },
    ],
    [t]
  )

  const onAfterAddView = (viewId: string) => {
    setExpandedViewId(viewId)
  }

  return (
    <BlockStack gap="300">
      <FeatureHelpBanner
        descriptionKey={
          '<tutorial>Watch tutorial</tutorial> or <contact>contact us</contact>'
          + ' for a live demo to turn your live preview into a high-converting experience.'
        }
        contactMessage="Hi, I want a realistic demo of creating mockups with an expert."
        onTutorialClick={handleOpenTutorial}
        padding="0"
        hideDivider
      />
      <VideoModal id={MOCKUP_TUTORIAL_VIDEO_MODAL} maximumWidth={720} minimumWidth={300}>
        <iframe
          width="100%"
          style={{ aspectRatio: '16/9' }}
          src={getEmbedUrl(MOCKUP_TUTORIAL_VIDEO_URL)}
          title={t('watch-tutorial')}
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen={true}
          loading="lazy"
          frameBorder="0"
        />
      </VideoModal>
      {items.map(view => {
        const isSelected = selectedViewIdStore === view._id
        const isExpanded = expandedViewId === view._id

        return (
          <Box
            key={view._id}
            padding="0"
            borderRadius="150"
            borderColor={isSelected ? 'border-brand' : 'border'}
            borderWidth={isSelected ? '050' : '025'}
            background={!isExpanded && isSelected ? 'bg-surface-secondary' : 'bg-surface'}
          >
            <s-stack gap="none">
              {/* Header */}
              <div
                style={{ cursor: 'pointer', padding: '12px' }}
                onClick={() => {
                  const nextId = view._id
                  if (expandedViewId === nextId) {
                    setExpandedViewId(undefined)
                    return
                  }

                  if (nextId !== selectedViewIdStore) {
                    IntegrationStore.dispatch({ type: 'SET_SELECTED_VIEW', payload: { mockupId, viewId: nextId } })
                  }
                  setExpandedViewId(nextId)
                  LayerIntegrationStoreSelection.resetState()
                  // Also ensure a layer in this view is selected for actions
                  // const v = (views || []).find(vw => vw._id === nextId)
                  // const firstLayerId = (v?.layers || [])
                  //   .map((it: any) => (typeof it === 'string' ? it : it?._id))
                  //   .filter(Boolean)[0]
                  // if (firstLayerId) {
                  //   const store = getLayerIntegrationStoreById(firstLayerId)
                  //   if (store) {
                  //     LayerIntegrationStoreSelection.dispatch({
                  //       type: 'SET_LAYER_STORE_SELECTION',
                  //       payload: { clickedLayerStore: store },
                  //     })
                  //   }
                  // }
                }}
              >
                <InlineStack gap="200" align="space-between" blockAlign="center" wrap={false}>
                  <Text variant="bodyMd" as="span" fontWeight="semibold">
                    {view.title || 'View'}
                  </Text>
                  <Box>
                    <s-icon type={isExpanded ? 'chevron-down' : 'chevron-right'} tone="subdued" />
                  </Box>
                </InlineStack>
              </div>

              {/* Content */}
              {isExpanded && (
                <Box>
                  <Bleed marginInline="100" marginBlockStart={'200'}>
                    <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} fitted>
                      <Box padding="400" paddingBlockStart="0" paddingInline="300">
                        <Box>
                          {selectedTab === 0 && (
                            <BlockStack gap="200">
                              <ViewTitle view={view} />
                              <MockupLayersManager viewId={view._id} />
                              <ClippingMaskEnabler viewId={view._id} variants={variants as any} mockupId={mockupId} />
                              <BaseImageUploader viewId={view._id} />
                              <BackgroundImageUploader viewId={view._id} />
                              <InlineStack gap="200" align="end">
                                <Button
                                  variant="tertiary"
                                  onClick={() => onDeleteView(view._id)}
                                  disabled={isDisabledDeleteView}
                                >
                                  {t('remove-view')}
                                </Button>
                              </InlineStack>
                            </BlockStack>
                          )}
                          {selectedTab === 1 && <AIMockup viewId={view._id} />}
                          {selectedTab === 2 && <MaskLayerUploader viewId={view._id} />}
                        </Box>
                      </Box>
                    </Tabs>
                  </Bleed>
                </Box>
              )}
            </s-stack>
          </Box>
        )
      })}

      {/* Add view button (primary, full width) — below all view cards */}
      <AddMockupViewButton onAfterAddView={onAfterAddView} />

      {/* Storefront label — below add view button */}
      <MockupViewLabelOnStorefront />

      {/* ImageSelector is handled inside reused uploaders */}
    </BlockStack>
  )
}

export default withMockup(MockupViewsManager)
