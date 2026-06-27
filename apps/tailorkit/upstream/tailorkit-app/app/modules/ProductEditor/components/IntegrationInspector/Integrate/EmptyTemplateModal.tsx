import { EmptyState, Text } from '@shopify/polaris'
import { memo } from 'react'
import type { TemplateTab } from './ModalTemplateSelection'
import { useTranslation } from 'react-i18next'
import { ILLUSTRATORS } from '~/constants/assets-url'

interface IEmptyTemplateModalProps {
  // renderTemplateCreation: React.ReactNode
  activeTab?: TemplateTab
}

export const EmptyTemplateModal = memo(function EmptyTemplateModal(props: IEmptyTemplateModalProps) {
  // const { activeTab = 'tailorkit' } = props
  const { t } = useTranslation()

  // const isYourTemplatesTab = activeTab === 'your'

  const heading = t('no-templates-yet')

  const description = t(
    'create-eye-catching-templates-to-apply-to-your-products-it-s-the-first-step-to-start-selling-with-style'
  )

  return (
    <EmptyState heading={heading} image={ILLUSTRATORS.SEARCH_IMAGE}>
      <s-stack direction="block" gap="base">
        <Text variant="bodyMd" as="p" alignment="center">
          {description}
        </Text>
        {/* <InlineStack align="center">{isYourTemplatesTab && renderTemplateCreation}</InlineStack> */}
      </s-stack>
    </EmptyState>
  )
})
