import { InlineStack, Box, Text, Icon } from '@shopify/polaris'
import { LocationIcon } from '@shopify/polaris-icons'

export const ProviderLocation = (props: { country: string | undefined }) => {
  const { country } = props

  if (!country) return null

  return (
    <InlineStack gap={'100'} blockAlign="start">
      <Box>
        <Icon source={LocationIcon} />
      </Box>
      <Text as="p" variant="bodyMd">
        {country}
      </Text>
    </InlineStack>
  )
}
