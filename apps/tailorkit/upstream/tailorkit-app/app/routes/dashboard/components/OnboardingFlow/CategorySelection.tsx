import { Text, Button, BlockStack, Icon, InlineStack, InlineGrid, Page, Box } from '@shopify/polaris'
import type { TFunction } from 'i18next'
import { CATEGORIES } from './constants'
import type { CategoryItem } from './constants'
import styles from './category-card.module.css'

interface CategorySelectionProps {
  t: TFunction
  /** Called immediately when a card is clicked — selects category and proceeds. */
  onCardClick: (id: string) => void
  onSkip: () => void
  isFirstTimeUser: boolean
  /**
   * Optional back action — renders Polaris `<Page backAction>` when provided.
   * Wired by callers who routed the merchant here as a discrete "create" entry
   * (e.g. "Full Editor" from the install-intent page or the dropdown), so the
   * merchant has an explicit way to bail back to the dashboard. Mirrors the
   * back button on the Quick Setup wizard's step 1.
   */
  onBack?: () => void
}

export function CategorySelection({ t, onCardClick, onSkip, isFirstTimeUser, onBack }: CategorySelectionProps) {
  // Heading + subtitle live on the Polaris <Page> so they pair with the back
  // button at the page-header level. The 8 sub-cards (CategoryCard) each carry
  // their own surface, so an outer Card wrapper would only add visual nesting.
  return (
    <Page
      backAction={onBack ? { content: t('dashboard'), onAction: onBack } : undefined}
      title={t('choose-a-feature-you-want-to-try-on-your-product')}
      subtitle={t('select-a-personalization-type-below-to-get-started')}
    >
      <BlockStack gap="400">
        <InlineGrid columns={{ xs: 2, md: 4 }} gap="300">
          {CATEGORIES.map(category => (
            <CategoryCard key={category.id} t={t} category={category} onClick={onCardClick} />
          ))}
        </InlineGrid>

        {!isFirstTimeUser && (
          <InlineStack align="start" blockAlign="center" wrap={false}>
            <Button variant="plain" onClick={onSkip}>
              {t('skip-onboarding')}
            </Button>
          </InlineStack>
        )}
      </BlockStack>
    </Page>
  )
}

function CategoryCard({
  t,
  category,
  onClick,
}: {
  t: TFunction
  category: CategoryItem
  onClick: (id: string) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.card}
      onClick={() => onClick(category.id)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(category.id)
        }
      }}
    >
      <Box padding="300" borderRadius="300" borderWidth="025" borderColor="border" background="bg-surface">
        <BlockStack gap="300" inlineAlign="center">
          {category.image ? (
            <img
              src={category.image}
              alt=""
              style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <Box
              background={category.isSpecial ? 'bg-fill-success-secondary' : 'bg-fill-secondary'}
              borderRadius="full"
              borderWidth="025"
              borderColor="border"
              padding="800"
            >
              <Icon source={category.icon} tone={category.isSpecial ? 'success' : 'subdued'} />
            </Box>
          )}
          <Text as="p" variant="headingSm" alignment="center">
            {t(category.name)}
          </Text>
          <Text as="p" variant="bodyMd" alignment="center">
            {t(category.description)}
          </Text>
        </BlockStack>
      </Box>
    </div>
  )
}
