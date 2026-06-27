import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  EmptySearchResult,
  Icon,
  InlineStack,
  Spinner,
  Text,
  TextField,
  Thumbnail,
} from '@shopify/polaris'
import { SearchIcon, ChevronLeftIcon, PageIcon, TextIcon, PlusIcon } from '@shopify/polaris-icons'
import styles from './styles.module.css'
import type { TemplateMentionData } from '~/hooks/useTemplateMention'
import { useTemplateMention } from '~/hooks/useTemplateMention'
import { useChatBot } from '~/providers/ChatBotContext'
import { useTranslation } from 'react-i18next'
import { getShopifyThumbnail } from '~/utils/loadImage'

interface BaseMentionItem {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
}

type MentionCategory = 'templates'

interface MentionCategoryOption extends BaseMentionItem {
  id: MentionCategory
}

interface LayerItem {
  id: string
  label: string
  type?: string
  image?: {
    src: string
    imageName: string
  }
}

export interface InternalMentionCardProps {
  onTemplateSelect?: (template: TemplateMentionData, allowMultiple?: boolean) => void
  onLayerSelect?: (layer: LayerItem, template: TemplateMentionData) => void
  onClose?: () => void
  mode?: 'categories' | 'direct' | 'templates'
  defaultAllowMultiple?: boolean
}

export const InternalMentionCard: React.FC<InternalMentionCardProps> = ({
  onTemplateSelect,
  onLayerSelect,
  onClose,
  mode = 'categories',
  defaultAllowMultiple = true,
}) => {
  const [currentView, setCurrentView] = useState<'categories' | 'templates' | 'layers'>(
    mode === 'templates' ? 'templates' : 'categories'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const { currentConversation } = useChatBot()
  const { templates, loading, searchTemplates } = useTemplateMention()
  const { t } = useTranslation()
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateMentionData | null>(null)
  const [layers, setLayers] = useState<LayerItem[]>([])

  const defaultMentionCategories: MentionCategoryOption[] = useMemo(
    () => [
      {
        id: 'templates',
        label: 'Templates',
        description: 'Reference templates from this conversation',
        icon: <PageIcon />,
      },
    ],
    []
  )

  const isDirectMode = mode === 'direct'

  const handleBackToCategories = useCallback((currentView: 'templates' | 'layers') => {
    setCurrentView(currentView)
    setSearchQuery('')
  }, [])

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value)
      if (currentView === 'templates') searchTemplates(value)
    },
    [searchTemplates, currentView]
  )

  const handleTemplateSelect = useCallback((template: TemplateMentionData) => {
    setSelectedTemplate(template)
    const nextLayers = Array.isArray(template.layers)
      ? template.layers
          .map(l => ({
            id: String((l as any)?._id || ''),
            label: String((l as any)?.label || ''),
            type: (l as any)?.type,
            image: (l as any)?.image,
          }))
          .filter(l => l.id && l.label)
      : []
    setLayers(nextLayers)
    setCurrentView('layers')
    setSearchQuery('')
  }, [])

  useEffect(() => {
    if (currentView !== 'templates') return
    if (!currentConversation.id) return
    if ((currentConversation.messages?.length ?? 0) === 0) return

    // Initial load when entering templates view or conversation changes
    searchTemplates('')
  }, [currentView, currentConversation.id, currentConversation.messages, searchTemplates])

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates
    return templates.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [templates, searchQuery])

  const filteredLayers = useMemo(() => {
    if (!searchQuery.trim()) return layers
    return layers.filter(l => l.label.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [layers, searchQuery])

  const renderMentionItem = (item: BaseMentionItem, onClick: () => void) => (
    <div key={item.id} className={styles.CategoryItem} onClick={onClick}>
      {item.icon && <div className={styles.CategoryIcon}>{item.icon}</div>}
      <div className={styles.CategoryContent}>
        <Text as="span" variant="bodyMd" fontWeight="medium">
          {item.label}
        </Text>
        {item.description && (
          <Text as="span" variant="bodySm" tone="subdued">
            {item.description}
          </Text>
        )}
      </div>
      <div className={styles.CategoryChevron}>
        <ChevronLeftIcon />
      </div>
    </div>
  )

  const renderTemplateItem = (template: TemplateMentionData) => (
    <div key={template.cardId} className={styles.TemplateItem} onClick={() => handleTemplateSelect(template)}>
      <InlineStack gap="150" align="start" wrap={false} blockAlign="center">
        {template.previewUrl ? (
          <div className={styles.TemplatePreview}>
            <img src={template.previewUrl} alt={template.name} />
          </div>
        ) : (
          <Box width="32px" minHeight="32px" />
        )}
        <Box width="calc(100% - 40px)">
          <InlineStack wrap={false} blockAlign="center" align="space-between" gap="100">
            <Text as="span" variant="bodyMd" truncate>
              {template.name}
            </Text>
            {template.isEditor && (
              <Box width="36%">
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('in-editor')}
                </Text>
              </Box>
            )}
          </InlineStack>
        </Box>
      </InlineStack>
    </div>
  )

  const handleCreateNewLayer = useCallback(() => {
    if (!selectedTemplate) return
    onTemplateSelect?.(selectedTemplate, false)
    onClose?.()
    setCurrentView('categories')
    setSearchQuery('')
  }, [onTemplateSelect, onClose, selectedTemplate])

  const renderContent = () => {
    if (isDirectMode) {
      return (
        <div className={styles.CategoryList}>
          {defaultMentionCategories.map(item => renderMentionItem(item, () => setCurrentView('templates')))}
        </div>
      )
    }

    // Show layers first if a template has been selected
    if (currentView === 'layers') {
      if (!selectedTemplate) {
        return (
          <Box padding="400" width="100%">
            <EmptySearchResult
              title={t('no-template-selected')}
              description={t('try-changing-the-search-term')}
              withIllustration
            />
          </Box>
        )
      }

      return (
        <>
          <Box paddingInline="200" paddingBlockEnd="100">
            <InlineStack align="end">
              <Button onClick={handleCreateNewLayer} variant="primary" icon={PlusIcon}>
                {t('add-layers')}
              </Button>
            </InlineStack>
          </Box>

          {filteredLayers.length === 0 ? (
            <Box padding="400" width="100%">
              <EmptySearchResult
                title={t('no-layers-found')}
                description={t('try-changing-the-search-term')}
                withIllustration
              />
            </Box>
          ) : (
            <div className={styles.TemplateList}>
              {filteredLayers.map(layer => (
                <div
                  key={layer.id}
                  className={styles.TemplateItem}
                  onClick={() => onLayerSelect?.(layer, selectedTemplate)}
                >
                  <InlineStack gap="150" align="start" wrap={false} blockAlign="center">
                    <Box width="calc(100% - 8px)">
                      <InlineStack wrap={false} blockAlign="center" gap="100">
                        {layer.type === 'image' ? (
                          <Thumbnail
                            source={getShopifyThumbnail(layer.image?.src)}
                            alt={layer.label}
                            size="extraSmall"
                          />
                        ) : (
                          <div
                            className="Polaris-Box emtlkit--d-flex emtlkit--flex-center"
                            style={{
                              ['--pc-box-border-color' as any]: 'var(--p-color-border)',
                              ['--pc-box-border-style' as any]: 'solid',
                              ['--pc-box-border-radius' as any]: 'var(--p-border-radius-150)',
                              ['--pc-box-border-width' as any]: 'var(--p-border-width-025)',
                              ['--pc-box-width' as any]: '24px',
                              height: '24px',
                            }}
                          >
                            <Icon source={TextIcon} />
                          </div>
                        )}
                        <Text as="span" variant="bodyMd" truncate>
                          {layer.label}
                        </Text>
                      </InlineStack>
                    </Box>
                  </InlineStack>
                </div>
              ))}
            </div>
          )}
        </>
      )
    }

    // Default templates list when in templates view
    if (currentView === 'templates') {
      if (loading) {
        return (
          <Box padding="400" width="100%">
            <InlineStack align="center" gap="200">
              <Spinner size="small" />
              <Text as="span" variant="bodySm">
                {t('loading-templates')}
              </Text>
            </InlineStack>
          </Box>
        )
      }
      if (filteredTemplates.length === 0) {
        return (
          <Box padding="400" width="100%">
            <EmptySearchResult
              title={t('no-templates-found')}
              description={t('try-changing-the-search-term')}
              withIllustration
            />
          </Box>
        )
      }
      return <div className={styles.TemplateList}>{filteredTemplates.map(renderTemplateItem)}</div>
    }

    return null
  }

  return (
    <>
      {(currentView === 'templates' || currentView === 'layers') && (
        <Box padding="200" width="100%">
          <InlineStack align="start" gap="200">
            {currentView === 'layers' && (
              <Button
                variant="plain"
                icon={ChevronLeftIcon}
                onClick={() => handleBackToCategories('templates')}
                accessibilityLabel="Back"
              />
            )}
            <div className={styles.SearchFieldContainer}>
              <TextField
                label=""
                prefix={<SearchIcon />}
                placeholder={currentView === 'layers' ? t('search-layers') : t('search-templates')}
                value={searchQuery}
                onChange={handleSearchChange}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => handleSearchChange('')}
                labelHidden
              />
            </div>
          </InlineStack>
        </Box>
      )}

      <div className={styles.ContentContainer}>{renderContent()}</div>
    </>
  )
}

export default InternalMentionCard
