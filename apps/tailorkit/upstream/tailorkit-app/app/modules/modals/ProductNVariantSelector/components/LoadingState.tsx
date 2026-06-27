import { InlineStack, Spinner } from '@shopify/polaris'

export const LoadingState = ({ size }: { size: 'small' | 'large' }) => {
  return (
    <InlineStack align="center">
      <Spinner size={size} />
    </InlineStack>
  )
}
