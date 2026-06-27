import type { ClientLoaderFunctionArgs } from '@remix-run/react'
import { useLoaderData } from '@remix-run/react'
import {
  Banner,
  Bleed,
  BlockStack,
  Button,
  Card,
  Icon,
  InlineGrid,
  InlineStack,
  Page,
  Tabs,
  TextField,
  useBreakpoints,
} from '@shopify/polaris'
import { PlusIcon, SearchIcon } from '@shopify/polaris-icons'
import { useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ContextualSaveBar from '~/components/ContextualSaveBar'
import { SortableList, linksSortableCSS } from '~/components/common/SortableList'
import { AiCreditExhaustedBanner } from '~/components/common/AiCreditExhaustedBanner'
import { useAiCreditsStatus } from '~/hooks/useAiCreditsStatus'
import type { PromptPresetDocument } from '~/models/PromptPreset'
import withIdleTracker from '~/modules/IdleTimeTracker/withIdleTracker'
import { withInteractiveChat } from '~/modules/InteractiveChat/withInteractiveChat'
import ImageSelector from '~/modules/modals/ImageSelector'
import { HydrateFallback } from '~/routes/dashboard/route'
import { authenticatedFetch } from '~/shopify/fns.client'
import { QuickPromptItem } from './components/QuickPromptItem'
import { QuickPromptSummary } from './components/QuickPromptSummary'
import { useQuickPrompts } from './hooks/useQuickPrompts'
import localStyles from './style.css?url'
import { useNavigateAppBridge } from '~/bootstrap/hooks/useNavigateAppBridge'
import useDevices from '~/utils/hooks/useDevice'
import withTooltip from '~/bootstrap/hoc/withTooltip'

export { HydrateFallback }

export const links = () => [...linksSortableCSS, { rel: 'stylesheet', href: localStyles }]

export const clientLoader = async ({ params, request }: ClientLoaderFunctionArgs) => {
  const res: { items: PromptPresetDocument[] } = await authenticatedFetch('/api/prompt-presets')

  return res?.items || []
}

export default withIdleTracker(
  withInteractiveChat(function Index() {
    const { t } = useTranslation()
    const navigate = useNavigateAppBridge()
    const _prompts = useLoaderData<typeof clientLoader>()
    const { hasCredits } = useAiCreditsStatus()

    const {
      filteredItems,
      editingPromptId,
      errorField,
      errorMessage,
      searchQuery,
      filterType,
      isFiltering,
      isDismissedClearFiltersBanner,
      imageSelectorActive,
      isSaving,
      hasChanges,
      tabTotalCount,
      setEditingPromptId,
      setSearchQuery,
      setFilterType,
      setErrorField,
      setErrorMessage,
      handleSort,
      handleAddPrompt,
      handleOpenThumbnailSelector,
      handleThumbnailSelect,
      handleDeleteThumbnail,
      handleDoneEditing,
      handleCancelEditing,
      handleDeletePrompt,
      handleFieldChange,
      handleDismissBanner,
      handleCloseImageSelector,
      getThumbnailUrls,
      handleDimensionSelect,
      handleCategoryChange,
      editingPromptDimensions,
      handleThumbnailSelectFromTest,
    } = useQuickPrompts(_prompts)

    const { mdDown } = useBreakpoints()
    const { isSmallMobileView } = useDevices()
    const listRef = useRef<HTMLDivElement>(null)

    const handleAddPromptWithScroll = useCallback(() => {
      handleAddPrompt()
      // Scroll to the new item after adding
      setTimeout(() => {
        const lastItem = listRef.current?.querySelector('.SortableItem:last-child')
        lastItem?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }, [handleAddPrompt])

    const tabs = useMemo(
      () => [
        { id: 'custom', content: t('your-effects') },
        { id: 'built-in', content: t('tailorkit-built-in') },
      ],
      [t]
    )

    const onTabSelect = useCallback(
      (index: number) => {
        if (hasChanges) {
          navigate('/')
          return
        }

        const tab = tabs[index]
        if (tab) setFilterType(tab.id as 'built-in' | 'custom')
      },
      [hasChanges, navigate, setFilterType, tabs]
    )

    const selectedTabIndex = tabs.findIndex(tab => tab.id === filterType)

    const ButtonWithTooltip = useMemo(() => withTooltip(Button), [])

    return (
      <Page
        title={t('ai-effects')}
        subtitle={t(
          'create-ai-effects-for-ai-image-generation-drag-and-drop-to-reorder-how-they-appear-to-you-and-buyers'
        )}
        backAction={{ content: t('back'), onAction: () => navigate('/storefront-setup') }}
      >
        <BlockStack gap="400">
          {!hasCredits && <AiCreditExhaustedBanner />}

          <Bleed marginInlineStart={isSmallMobileView ? '0' : '300'}>
            <Tabs tabs={tabs} selected={selectedTabIndex} onSelect={onTabSelect} />
          </Bleed>

          <InlineGrid gap="400" alignItems="start" columns={{ sm: 1, md: '1fr 320px' }}>
            {mdDown && (
              <QuickPromptSummary
                totalCount={tabTotalCount}
                filteredCount={filteredItems.length}
                isFiltering={isFiltering}
              />
            )}

            <Card>
              <BlockStack gap="400">
                <InlineStack gap={filterType === 'custom' ? '200' : '0'}>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label={t('search')}
                      labelHidden
                      prefix={<Icon source={SearchIcon} />}
                      value={searchQuery}
                      onChange={setSearchQuery}
                      autoComplete="off"
                      placeholder={t('search-quick-prompts')}
                      clearButton
                      onClearButtonClick={() => setSearchQuery('')}
                    />
                  </div>

                  {filterType === 'custom' ? (
                    <ButtonWithTooltip
                      tooltipContent={hasChanges ? t('save-changes-to-add-prompt') : undefined}
                      disabled={hasChanges || !hasCredits}
                      icon={PlusIcon}
                      onClick={handleAddPromptWithScroll}
                      size="slim"
                    >
                      {t('add-quick-prompt')}
                    </ButtonWithTooltip>
                  ) : null}
                </InlineStack>

                {isFiltering && !isDismissedClearFiltersBanner && (
                  <Banner tone="info" onDismiss={handleDismissBanner}>
                    {t('clear-filters-to-reorder-prompts')}
                  </Banner>
                )}

                <Card padding="0">
                  <div id="quick-prompts-list" ref={listRef}>
                    <SortableList
                      items={filteredItems}
                      onChange={isFiltering ? () => {} : handleSort}
                      renderItem={item => {
                        const isFirstItem = filteredItems.length > 0 && item.id === filteredItems[0]._id
                        const isEditing
                          = editingPromptId !== null && filteredItems.find(i => i.id === editingPromptId)?.id === item.id

                        return (
                          <SortableList.Item id={item._id} onClick={() => !errorField && setEditingPromptId(item.id)}>
                            <QuickPromptItem
                              item={item}
                              isEditing={isEditing}
                              isFirstItem={isFirstItem}
                              isFiltering={isFiltering}
                              errorField={errorField}
                              errorMessage={errorMessage}
                              thumbnailUrls={getThumbnailUrls(item._id)}
                              currentDimensions={editingPromptDimensions}
                              onFieldChange={handleFieldChange}
                              onCategoryChange={handleCategoryChange}
                              onOpenThumbnailSelector={(replaceIndex?: number) =>
                                handleOpenThumbnailSelector(item._id, replaceIndex)
                              }
                              onDeleteThumbnail={index => handleDeleteThumbnail(item._id, index)}
                              onDelete={handleDeletePrompt}
                              onErrorClear={() => {
                                setErrorField(null)
                                setErrorMessage(null)
                              }}
                              onDimensionSelect={handleDimensionSelect}
                              onSelectThumbnailFromTest={handleThumbnailSelectFromTest}
                            />
                          </SortableList.Item>
                        )
                      }}
                    />
                  </div>
                </Card>
              </BlockStack>
            </Card>

            {!mdDown && (
              <QuickPromptSummary
                totalCount={tabTotalCount}
                filteredCount={filteredItems.length}
                isFiltering={isFiltering}
              />
            )}
          </InlineGrid>
        </BlockStack>

        {imageSelectorActive && (
          <ImageSelector
            active={imageSelectorActive}
            allowMultiple
            maxSelection={2}
            onSelectImage={handleThumbnailSelect}
            onClose={handleCloseImageSelector}
          />
        )}

        <ContextualSaveBar
          isOpen={hasChanges}
          loading={isSaving}
          onSave={handleDoneEditing}
          onDiscard={handleCancelEditing}
        />
      </Page>
    )
  })
)
