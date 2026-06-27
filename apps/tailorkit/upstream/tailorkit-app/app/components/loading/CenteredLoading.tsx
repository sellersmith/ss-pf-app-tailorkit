import { InlineStack, Spinner } from '@shopify/polaris'

export default function CenteredLoading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <InlineStack align="center">
        <Spinner />
      </InlineStack>
    </div>
  )
}
