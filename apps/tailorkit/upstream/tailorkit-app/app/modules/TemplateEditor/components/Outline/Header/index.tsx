import { Box, InlineStack, Text } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import ButtonCollapsibleOutline from './ButtonCollapsibleOutline'

export default function OutlineHeader() {
  const { t } = useTranslation()

  return (
    <Box paddingBlock={'300'} paddingInline={'400'}>
      <InlineStack align="space-between" blockAlign="center">
        <Text as="h3" variant="bodyMd">
          {t('layers')}
        </Text>
        <ButtonCollapsibleOutline />
      </InlineStack>
    </Box>
  )
}
