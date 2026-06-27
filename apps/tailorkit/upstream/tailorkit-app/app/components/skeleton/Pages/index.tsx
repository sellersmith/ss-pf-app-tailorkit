import { BlockStack, Card, Grid, SkeletonBodyText, SkeletonDisplayText, SkeletonPage } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import { SkeletonListTable } from './SkeletonListTable'

export { SkeletonListTable } from './SkeletonListTable'
export { SkeletonStorefrontSetup } from './SkeletonStorefrontSetup'
export { SkeletonAnalytics } from './SkeletonAnalytics'

/**
 * Skeleton for Personalized Products page
 */
export function SkeletonPersonalizedProducts() {
  const { t } = useTranslation()
  return <SkeletonListTable titleKey={t('personalized-products')} showPrimaryAction />
}

/**
 * Skeleton for Templates page
 */
export function SkeletonTemplates() {
  const { t } = useTranslation()
  return <SkeletonListTable titleKey={t('templates')} showPrimaryAction />
}

/**
 * Skeleton for Orders page
 */
export function SkeletonOrders() {
  const { t } = useTranslation()
  return <SkeletonListTable titleKey={t('orders')} showPrimaryAction={false} />
}

/**
 * Skeleton for Checkboxes index page
 */
export function SkeletonCheckboxes() {
  const { t } = useTranslation()
  return <SkeletonListTable titleKey={t('add-on-products')} showPrimaryAction />
}

/**
 * Skeleton for Checkbox edit page
 * Matches the CheckboxForm layout with Grid (8/4 columns)
 */
export function SkeletonCheckboxEdit() {
  const { t } = useTranslation()

  return (
    <SkeletonPage title={t('create-addon')} fullWidth backAction>
      <Grid gap={{ xs: '400' }}>
        {/* Settings Column - 8 columns */}
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 8, xl: 8 }}>
          <BlockStack gap="400">
            {/* Widget Config Card */}
            <Card>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={2} />
              </BlockStack>
            </Card>

            {/* Placement Card */}
            <Card>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={3} />
              </BlockStack>
            </Card>

            {/* Trigger Products Card */}
            <Card>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={4} />
              </BlockStack>
            </Card>

            {/* Upsell Product Card */}
            <Card>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={3} />
              </BlockStack>
            </Card>

            {/* Display Content Card */}
            <Card>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={4} />
              </BlockStack>
            </Card>

            {/* Popup Settings Card */}
            <Card>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <SkeletonBodyText lines={3} />
              </BlockStack>
            </Card>
          </BlockStack>
        </Grid.Cell>

        {/* Preview Column - 4 columns */}
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 2, lg: 4, xl: 4 }}>
          <Card>
            <BlockStack gap="400">
              <SkeletonDisplayText size="small" />
              <SkeletonBodyText lines={8} />
            </BlockStack>
          </Card>
        </Grid.Cell>
      </Grid>
    </SkeletonPage>
  )
}
