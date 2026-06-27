import { BlockStack, Box, Button, Card, Icon, InlineGrid, InlineStack, Text, useBreakpoints } from '@shopify/polaris'
import {
  ChevronRightIcon,
  MagicIcon,
  ProductAddIcon,
  EditIcon,
  TextIcon,
  PaintBrushFlatIcon,
  ImageIcon,
  QuestionCircleIcon,
} from '@shopify/polaris-icons'
import type { ISuggestion } from '../constants'
import { SUGGESTIONS } from '../constants'
import { useTranslation } from 'react-i18next'

/** Map suggestion IDs to icons for vertical layout */
const SUGGESTION_ICON_MAP: Record<string, any> = {
  customize_this_product: PaintBrushFlatIcon,
  add_text_engraving: TextIcon,
  add_image_upload: ImageIcon,
  what_can_elva_do: QuestionCircleIcon,
  ai_onboarding_create_first_product: ProductAddIcon,
  ai_onboarding_create_first_product_2: EditIcon,
}

interface SuggestionsListProps {
  suggestions?: (typeof SUGGESTIONS)[number][]
  onSuggestionClick?: (suggestion: (typeof SUGGESTIONS)[number]) => void
  layout?: 'card' | 'button' | 'vertical'
  buttonAlign?: 'start' | 'center' | 'end'
  showIcon?: boolean
}

export default function SuggestionsList(props: SuggestionsListProps) {
  const {
    suggestions = SUGGESTIONS,
    onSuggestionClick,
    layout = 'button',
    buttonAlign = 'start',
    showIcon = true,
  } = props

  const { t } = useTranslation()
  const { mdDown, smDown } = useBreakpoints()

  if (layout === 'vertical') {
    return (
      <BlockStack gap="200">
        <Text as="p" variant="bodySm" tone="subdued" fontWeight="semibold">
          {t('suggest-actions').toUpperCase()}
        </Text>
        {suggestions.map(suggestion => {
          const iconSource = suggestion.icon || SUGGESTION_ICON_MAP[suggestion.id] || MagicIcon
          return (
            <div
              key={suggestion.id}
              onClick={() => onSuggestionClick?.(suggestion)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px solid var(--p-color-border)',
                cursor: 'pointer',
                background: 'var(--p-color-bg-surface)',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.background = 'var(--p-color-bg-surface-hover)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.background = 'var(--p-color-bg-surface)'
              }}
            >
              {/* Icon circle */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--p-color-bg-fill-success-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon source={iconSource} tone="success" />
              </div>
              {/* Label */}
              <Text as="span" variant="bodyMd" fontWeight="medium">
                {t(suggestion.label)}
              </Text>
              {/* Chevron */}
              <div style={{ marginLeft: 'auto', flexShrink: 0, opacity: 0.4 }}>
                <Icon source={ChevronRightIcon} tone="subdued" />
              </div>
            </div>
          )
        })}
      </BlockStack>
    )
  }

  if (layout === 'card') {
    return (
      <BlockStack align="center">
        <Box width={`${smDown ? '100%' : mdDown ? '400px' : '560px'}`}>
          <InlineGrid gap={mdDown ? '200' : '400'} columns={smDown ? 1 : suggestions.length}>
            {suggestions.map(suggestion => (
              <SuggestionItem
                key={suggestion.id}
                suggestion={suggestion}
                onSuggestionClick={onSuggestionClick}
                layout="card"
                showIcon={showIcon}
              />
            ))}
          </InlineGrid>
        </Box>
      </BlockStack>
    )
  }

  return (
    <Box paddingBlockEnd="400">
      <InlineStack gap="200" align={buttonAlign}>
        {suggestions.map(suggestion => (
          <SuggestionItem
            key={suggestion.id}
            suggestion={suggestion}
            onSuggestionClick={onSuggestionClick}
            showIcon={showIcon}
          />
        ))}
      </InlineStack>
    </Box>
  )
}

export const SuggestionItem = ({
  suggestion,
  onSuggestionClick,
  layout = 'button',
  showIcon = true,
}: {
  suggestion: ISuggestion
  onSuggestionClick?: (suggestion: ISuggestion) => void
  layout?: string
  showIcon?: boolean
}) => {
  const { t } = useTranslation()
  const { smDown } = useBreakpoints()

  const iconSource = suggestion.icon || SUGGESTION_ICON_MAP[suggestion.id] || MagicIcon

  const Wrapper = smDown ? InlineGrid : BlockStack

  return layout === 'card' ? (
    <Card key={suggestion.id} padding="150">
      <div style={{ cursor: 'pointer' }} onClick={() => onSuggestionClick?.(suggestion)}>
        <Wrapper gap="150" {...(smDown ? { columns: '80px 1fr', alignItems: 'center' } : {})}>
          {suggestion.illustration ? (
            <img
              alt={suggestion.label}
              src={suggestion.illustration}
              style={{ width: '100%', border: '1px solid #e3e3e3', borderRadius: '8px' }}
            />
          ) : (
            <Icon source={iconSource} />
          )}
          <Box paddingBlock="050" paddingInline="100">
            <Text as="p" variant="bodyMd" fontWeight="medium" alignment={smDown ? 'start' : 'center'}>
              {t(suggestion.label)}
            </Text>
          </Box>
        </Wrapper>
      </div>
    </Card>
  ) : (
    <Button
      key={suggestion.id}
      icon={showIcon ? <Icon source={iconSource} /> : undefined}
      onClick={() => {
        onSuggestionClick?.(suggestion)
      }}
    >
      {t(suggestion.label)}
    </Button>
  )
}
