import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '~/libs/external-store'
import TextFieldValidation from '~/modules/TemplateEditor/common/text-field-validation'
import type { WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import withMockup from '~/modules/ProductEditor/withMockup'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import { useDebouncedCallback } from '~/utils/hooks/useDebouncedCallback'
import { Icon, InlineStack, Text, Tooltip } from '@shopify/polaris'
import { Flex } from '~/components/common/Flex'
import { InfoIcon } from '@shopify/polaris-icons'

function MockupViewLabelOnStorefront(props: WithVariantsProps) {
  const { mockupId } = props
  const { t } = useTranslation()
  const storefrontLabel = useStore(
    IntegrationStore,
    s => s.variants.find(v => v.mockup._id === mockupId)?.mockup?.storefrontLabel
  )
  const [tempStorefrontLabel, setTempStorefrontLabel] = useState(storefrontLabel || t('select-view'))

  const dispatchUpdate = useDebouncedCallback((value: string) => {
    if (value !== storefrontLabel) {
      IntegrationStore.dispatch({
        type: 'UPDATE_MOCKUP_STOREFRONT_LABEL',
        payload: { mockupId, storefrontLabel: value || '' },
      })
    }
  }, 300)

  const handleChange = (value: string) => {
    setTempStorefrontLabel(value)
    dispatchUpdate(value)
  }

  return (
    <TextFieldValidation
      label={
        <InlineStack gap={'100'}>
          <Text as="span" variant="bodyMd">
            {t('storefront-label')}
          </Text>
          <Tooltip
            content={t(
              'the-label-displayed-above-the-view-selection-options-on-your-storefront-only-visible-when-you-have-at-least-2-views'
            )}
          >
            <Flex>
              <Icon source={InfoIcon} tone="base" />
            </Flex>
          </Tooltip>
        </InlineStack>
      }
      autoComplete="off"
      value={tempStorefrontLabel}
      onChange={handleChange}
      onBlur={() => (!tempStorefrontLabel ? setTempStorefrontLabel(t('select-view')) : undefined)}
      placeholder={t('enter-a-label-to-show-on-storefront')}
      showCharacterCount
      maxLength={60}
    />
  )
}

export default withMockup(MockupViewLabelOnStorefront)
