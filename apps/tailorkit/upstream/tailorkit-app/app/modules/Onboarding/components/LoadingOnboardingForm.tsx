import { Box, InlineStack, Spinner } from '@shopify/polaris'

export default function LoadingOnboardingForm() {
  return (
    <Box width="100%">
      <InlineStack align="center">
        <Spinner />
      </InlineStack>
    </Box>
  )
}
