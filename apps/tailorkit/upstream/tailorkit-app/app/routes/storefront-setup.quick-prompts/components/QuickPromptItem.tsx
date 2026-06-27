import {
  Badge,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  Icon,
  InlineError,
  InlineGrid,
  InlineStack,
  Select,
  Text,
  TextField,
} from '@shopify/polaris'
import { AlertCircleIcon, DragHandleIcon, DeleteIcon, PlusIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { PromptPresetDocument } from '~/models/PromptPreset'
import { EFFECT_CATEGORIES } from '~/modules/PromptPresets/constants'
import { DragHandle } from './DragHandle'
import PromptPresets from '~/modules/PromptPresets'
import type { DimensionType } from '../utils/instructionDimensions'
import { useCallback, useMemo } from 'react'
import AITextField from '~/components/AITextField'
import PopoverAIContentGenerator from '~/components/AITextField/PopoverAIContentGenerator'
import { TestPromptSection } from './TestPromptSection'
import type { IImageQuery } from '~/types/shopify-files'
import { AccordionList } from '~/components/Accordion'
import ExpandableThumbnail from '~/components/Thumbnail'

interface QuickPromptItemProps {
  item: PromptPresetDocument & { id: string }
  isEditing: boolean
  isFirstItem: boolean
  isFiltering: boolean
  errorField: string | null
  errorMessage: string | null
  thumbnailUrls: string[]
  currentDimensions: {
    template_type: string | null
    visual_style: string | null
    content_theme: string | null
  }
  onFieldChange: (field: 'name' | 'instruction', value: string) => void
  onCategoryChange: (category: string | null) => void
  onOpenThumbnailSelector: (replaceIndex?: number) => void
  onDeleteThumbnail?: (index: number) => void
  onDelete: () => void
  onErrorClear: (field: string) => void
  onDimensionSelect: (dimensionType: DimensionType, selectedNames: string[]) => void
  onSelectThumbnailFromTest?: (images: IImageQuery[]) => void
}

export function QuickPromptItem({
  item,
  isEditing,
  isFirstItem,
  isFiltering,
  errorField,
  errorMessage,
  thumbnailUrls,
  currentDimensions,
  onFieldChange,
  onCategoryChange,
  onOpenThumbnailSelector,
  onDeleteThumbnail,
  onDelete,
  onErrorClear,
  onDimensionSelect,
  onSelectThumbnailFromTest,
}: QuickPromptItemProps) {
  const { t } = useTranslation()

  const visualStyleSelected = useMemo(() => {
    return currentDimensions.visual_style ? [currentDimensions.visual_style] : []
  }, [currentDimensions.visual_style])

  const templateTypeSelected = useMemo(() => {
    return currentDimensions.template_type ? [currentDimensions.template_type] : []
  }, [currentDimensions.template_type])

  const contentThemeSelected = useMemo(() => {
    return currentDimensions.content_theme ? [currentDimensions.content_theme] : []
  }, [currentDimensions.content_theme])

  const onSelectVisualStyle = useCallback(
    (names: string[]) => {
      onDimensionSelect('visual_style', names)
    },
    [onDimensionSelect]
  )

  const onSelectTemplateType = useCallback(
    (names: string[]) => {
      onDimensionSelect('template_type', names)
    },
    [onDimensionSelect]
  )

  const onSelectContentTheme = useCallback(
    (names: string[]) => {
      onDimensionSelect('content_theme', names)
    },
    [onDimensionSelect]
  )

  const categoryOptions = useMemo(
    () => [
      { label: t('none'), value: '' },
      ...EFFECT_CATEGORIES.filter(c => c.id !== 'all' && c.id !== 'popular').map(c => ({
        label: t(c.label),
        value: c.id,
      })),
    ],
    [t]
  )

  return (
    <Box width="100%" padding="200" borderColor="border" borderBlockStartWidth={isFirstItem ? '0' : '025'}>
      <InlineGrid gap="200" columns="20px 1fr" alignItems={isEditing ? 'start' : 'center'}>
        {isFiltering ? (
          <div style={{ width: '20px', opacity: 0.3 }}>
            <Icon source={DragHandleIcon} />
          </div>
        ) : (
          <DragHandle />
        )}

        {isEditing ? (
          <BlockStack gap="200">
            <TextField
              requiredIndicator
              showCharacterCount
              maxLength={60}
              value={item.name}
              label={t('label')}
              autoComplete="off"
              placeholder={t('quick-prompt-label-placeholder')}
              error={errorField === 'name'}
              onFocus={() => {
                if (errorField === 'name') {
                  onErrorClear('name')
                }
              }}
              helpText={
                errorField === 'name' && errorMessage ? (
                  <div className="emtlkit--quick-prompt-has-error">
                    <InlineGrid gap="100" columns="20px 1fr">
                      <Icon source={AlertCircleIcon} tone="critical" />
                      <Text as="span" variant="bodyMd" tone="critical">
                        {errorMessage}
                      </Text>
                    </InlineGrid>
                  </div>
                ) : undefined
              }
              onChange={name => onFieldChange('name', name)}
            />

            <AITextField
              requiredIndicator
              showCharacterCount
              multiline={3}
              maxLength={500}
              autoComplete="off"
              label={t('content')}
              value={item.instruction}
              placeholder={t('quick-prompt-content-placeholder')}
              error={errorField === 'instruction'}
              onFocus={() => {
                if (errorField === 'instruction') {
                  onErrorClear('instruction')
                }
              }}
              helpText={
                errorField === 'instruction' && errorMessage ? (
                  <div className="emtlkit--quick-prompt-has-error">
                    <InlineGrid gap="100" columns="20px 1fr">
                      <Icon source={AlertCircleIcon} tone="critical" />
                      <Text as="span" variant="bodyMd" tone="critical">
                        {errorMessage}
                      </Text>
                    </InlineGrid>
                  </div>
                ) : undefined
              }
              onChange={instruction => onFieldChange('instruction', instruction)}
              popoverContent={
                <PopoverAIContentGenerator
                  title={t('generate-prompt-content')}
                  value={item.instruction}
                  mainTextLabel={t('what-is-this-prompt-about')}
                  placeholderMainTextLabel={t('quick-prompt-ai-main-text-placeholder')}
                  optionalTextLabel={t('special-instructions-optional')}
                  placeholderOptionalTextLabel={t('quick-prompt-ai-optional-text-placeholder')}
                  maxContentLength={500}
                  onSelectOptionAfterGenerating={options => {
                    if (options.length > 0) {
                      onFieldChange('instruction', options[0])
                    }
                  }}
                />
              }
            />

            <Select
              label={t('category')}
              options={categoryOptions}
              value={item.category || ''}
              onChange={value => onCategoryChange(value || null)}
            />

            {/* Dimension selectors - Visual Style, Template Type, Content Theme */}
            <BlockStack>
              <AccordionList
                items={[
                  {
                    id: `visual-style-${item.id}`,
                    label: (
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodyMd" as="p">
                          {t('visual-style')}
                        </Text>
                        {visualStyleSelected.length > 0 && <Badge>{visualStyleSelected[0]}</Badge>}
                      </InlineStack>
                    ),
                    open: false,
                    content: (
                      <PromptPresets
                        type="visual_style"
                        layout="carousel"
                        itemsPerRow={3}
                        selected={visualStyleSelected}
                        onSelect={onSelectVisualStyle}
                        viewAll
                        showLabel={false}
                      />
                    ),
                  },
                  {
                    id: `template-type-${item.id}`,
                    label: (
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodyMd" as="p">
                          {t('template-type')}
                        </Text>
                        {templateTypeSelected.length > 0 && <Badge>{templateTypeSelected[0]}</Badge>}
                      </InlineStack>
                    ),
                    open: false,
                    content: (
                      <PromptPresets
                        type="template_type"
                        layout="carousel"
                        itemsPerRow={3}
                        selected={templateTypeSelected}
                        onSelect={onSelectTemplateType}
                        viewAll
                        showLabel={false}
                      />
                    ),
                  },
                  {
                    id: `content-theme-${item.id}`,
                    label: (
                      <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodyMd" as="p">
                          {t('content-theme')}
                        </Text>
                        {contentThemeSelected.length > 0 && <Badge>{contentThemeSelected[0]}</Badge>}
                      </InlineStack>
                    ),
                    open: false,
                    content: (
                      <PromptPresets
                        type="content_theme"
                        layout="carousel"
                        itemsPerRow={3}
                        selected={contentThemeSelected}
                        onSelect={onSelectContentTheme}
                        viewAll
                        showLabel={false}
                      />
                    ),
                  },
                ]}
                hideDivider={false}
                paddingBlockEnd="300"
              />
            </BlockStack>

            {/* Test Prompt Section */}
            <Card background="bg-surface-secondary">
              <TestPromptSection
                instruction={item.instruction}
                thumbnailUrls={thumbnailUrls}
                templateType={currentDimensions.template_type}
                visualStyle={currentDimensions.visual_style}
                contentTheme={currentDimensions.content_theme}
                onSelectThumbnail={onSelectThumbnailFromTest}
              />
            </Card>

            <BlockStack gap="200" id="thumbnail-section">
              <Text as="span" variant="bodyMd">
                {t('thumbnail')}{' '}
                <Text as="span" tone="critical">
                  *
                </Text>
              </Text>

              <InlineStack gap="200" align="start" blockAlign="start">
                {thumbnailUrls.map((url, index) => (
                  <BlockStack key={index} gap="100" align="center">
                    <ExpandableThumbnail src={url} alt={`Thumbnail ${index + 1}`} size="large" />
                    {onDeleteThumbnail && (
                      <Button size="slim" icon={DeleteIcon} onClick={() => onDeleteThumbnail(index)} />
                    )}
                  </BlockStack>
                ))}
                {thumbnailUrls.length < 2 && (
                  <div
                    onClick={() => onOpenThumbnailSelector()}
                    style={{
                      width: '80px',
                      height: '80px',
                      border: '2px dashed var(--p-color-border-secondary)',
                      borderRadius: 'var(--p-border-radius-200)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      backgroundColor: 'var(--p-color-bg-surface-secondary)',
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onOpenThumbnailSelector()
                      }
                    }}
                  >
                    <Icon source={PlusIcon} tone="subdued" />
                  </div>
                )}
              </InlineStack>

              {errorField === 'thumbnail' && errorMessage && <InlineError message={errorMessage} fieldID="thumbnail" />}
            </BlockStack>

            {!item.imported && (
              <>
                <Divider borderColor="border" borderWidth="025" />
                <Button
                  tone="critical"
                  onClick={() => {
                    onDelete()
                  }}
                >
                  {t('delete')}
                </Button>
              </>
            )}
          </BlockStack>
        ) : (
          <InlineStack gap="200" align="start">
            <Text as="span" variant="bodyMd">
              {item.name}
            </Text>
            {item.imported && <Badge tone="info">{t('built-in')}</Badge>}
          </InlineStack>
        )}
      </InlineGrid>
    </Box>
  )
}
