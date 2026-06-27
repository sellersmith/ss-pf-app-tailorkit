import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BlockStack, Box, Button, InlineGrid, InlineStack, Link, Text, TextField } from '@shopify/polaris'
import { SearchIcon } from '@shopify/polaris-icons'
import GridCarousel from '~/components/GridCarousel'
import { useRootLoaderData } from '~/root'
import { usePromptPresets } from './usePromptPresets'
import { InlineLayout, ListLayout, CarouselLayout, GridLayout } from './layouts'
import type { PromptPresetsProps } from './types'

const TOOLTIP_HOVER_DELAY = 500

const PromptPresets = ({
  label,
  viewAll,
  onSelect,
  selected,
  filterItems,
  layout = 'grid',
  itemsPerRow = 3,
  multiple = false,
  showLabel = true,
  showSearch = false,
  type = 'quick_prompt',
  toggleThumbnailOnMouseOver = true,
  showSelectAllButtons = false,
  required = false,
}: PromptPresetsProps) => {
  const { t } = useTranslation()
  const { shopData: { shopDomain } = {}, PUBLIC_ENV: { APP_HANDLE } = {} } = useRootLoaderData() || {}
  const [showAll, setShowAll] = useState(viewAll)

  const labels: Record<string, string> = useMemo(
    () => ({
      quick_prompt: t('quick-prompt'),
      visual_style: t('visual-style'),
      content_theme: t('content-theme'),
      template_type: t('template-type'),
    }),
    [t]
  )

  const {
    isLoading,
    presets,
    sortedPresets,
    selectedPreset,
    hoveredItem,
    searchQuery,
    isAllSelected,
    isNoneSelected,
    handleItemClick,
    handleSelectAll,
    handleDeselectAll,
    handleMouseEnter,
    handleMouseLeave,
    handleSearchChange,
    getThumbnailUrl,
  } = usePromptPresets({
    type,
    layout,
    multiple,
    required,
    toggleThumbnailOnMouseOver,
    selected,
    filterItems,
    onSelect,
  })

  const handleToggleView = useCallback(() => {
    setShowAll(prev => !prev)
  }, [])

  // Prepare items
  const hasMoreItems = !viewAll && sortedPresets?.length > itemsPerRow
  const displayedPresets
    = viewAll || !hasMoreItems || showAll
      ? sortedPresets
      : sortedPresets.slice(0, Math.max(1, itemsPerRow - (['grid', 'carousel'].includes(layout) ? 1 : 0)))

  // Common layout props
  const layoutProps = useMemo(
    () => ({
      presets: displayedPresets,
      selectedPreset,
      hoveredItem,
      itemsPerRow,
      hasMoreItems,
      showAll: showAll ?? false,
      hoverDelay: TOOLTIP_HOVER_DELAY,
      getThumbnailUrl,
      onItemClick: handleItemClick,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onToggleView: handleToggleView,
    }),
    [
      displayedPresets,
      selectedPreset,
      hoveredItem,
      itemsPerRow,
      hasMoreItems,
      showAll,
      getThumbnailUrl,
      handleItemClick,
      handleMouseEnter,
      handleMouseLeave,
      handleToggleView,
    ]
  )

  // Render loading skeleton
  const renderSkeleton = useCallback(() => {
    const skeletonItems = Array(itemsPerRow)
      .fill(null)
      .map((_, index) => <Box key={index} background="bg-surface-secondary" borderRadius="200" minHeight="120px" />)

    switch (layout) {
      case 'inline':
        return (
          <InlineStack gap="200" wrap={true}>
            {Array(itemsPerRow)
              .fill(null)
              .map((_, index) => (
                <Box
                  key={index}
                  padding="100"
                  minWidth="80px"
                  minHeight="20px"
                  borderRadius="200"
                  background="bg-surface-secondary"
                />
              ))}
          </InlineStack>
        )
      case 'list':
        return (
          <BlockStack gap="200">
            {Array(itemsPerRow)
              .fill(null)
              .map((_, index) => (
                <Box key={index} background="bg-surface-secondary" borderRadius="200" minHeight="48px" />
              ))}
          </BlockStack>
        )
      case 'carousel':
        return (
          <GridCarousel gap="var(--p-space-100)" showDots={true} itemsPerSlide={itemsPerRow}>
            {skeletonItems}
          </GridCarousel>
        )
      default:
        return (
          <InlineGrid columns={3} gap="200">
            {skeletonItems}
          </InlineGrid>
        )
    }
  }, [itemsPerRow, layout])

  // Render content based on state
  const renderContent = useCallback(() => {
    if (isLoading) {
      return renderSkeleton()
    }

    if (!presets?.length) {
      return (
        <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
          {t('no-presets-found-for-this-type')}
        </Text>
      )
    }

    switch (layout) {
      case 'inline':
        return <InlineLayout {...layoutProps} />
      case 'list':
        return <ListLayout {...layoutProps} />
      case 'carousel':
        return <CarouselLayout {...layoutProps} />
      default:
        return <GridLayout {...layoutProps} />
    }
  }, [isLoading, layout, layoutProps, presets?.length, renderSkeleton, t])

  return (
    <Box paddingBlockStart="100">
      <BlockStack gap="200">
        {showLabel && (
          <Text as="h3" variant="bodyMd">
            {label || labels[type]}
          </Text>
        )}

        {showSearch && (
          <TextField
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={t('search-quick-prompts')}
            autoComplete="off"
            label={t('search-quick-prompts')}
            labelHidden
            prefix={<SearchIcon />}
            clearButton
            onClearButtonClick={() => handleSearchChange('')}
          />
        )}

        {showSelectAllButtons && multiple && presets.length > 0 && (
          <InlineStack align="space-between">
            <Link
              removeUnderline
              url={`https://${shopDomain}/admin/apps/${APP_HANDLE}/storefront-setup/quick-prompts`}
              target="_blank"
            >
              {t('manage-ai-effects')}
            </Link>

            <InlineStack gap="200" align="end">
              <Button variant="plain" onClick={handleSelectAll} disabled={isAllSelected}>
                {t('select-all')}
              </Button>
              <Button variant="plain" onClick={handleDeselectAll} disabled={isNoneSelected}>
                {t('deselect-all')}
              </Button>
            </InlineStack>
          </InlineStack>
        )}

        {renderContent()}
      </BlockStack>
    </Box>
  )
}

export default memo(PromptPresets)
