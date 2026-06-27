import { BlockStack, Box, InlineStack, Thumbnail, Text, Badge } from '@shopify/polaris'
import { getShopifyThumbnail } from '~/utils/loadImage'
import { CharmCountBadge } from './CharmCountBadge'

interface IOrderLineItemPopoverCardProps {
  line_item: any
  charmCount?: number
}

function OrderLineItemPopoverCard(props: IOrderLineItemPopoverCardProps) {
  const { line_item, charmCount = 0 } = props

  const { id, product, variant_id, current_quantity, variant_title } = line_item

  // Get product information
  const variant = product?.variants.find((variant: any) => variant.id.indexOf(variant_id) > -1)
  const title = product?.title
  const image = (variant?.image || product?.featuredImage)?.url

  return (
    <Box key={id} borderColor="border" borderBlockEndWidth={'025'} paddingInline={'400'} paddingBlock={'200'}>
      <BlockStack gap={'200'}>
        <InlineStack gap="200" blockAlign="center" wrap={false}>
          <Box>
            <Thumbnail source={getShopifyThumbnail(image)} alt={title} size="small" />
          </Box>
          <Box width="100%">
            <BlockStack gap={'150'}>
              <InlineStack align="space-between" gap="200">
                <Text variant="bodyMd" as="span">
                  {title}
                </Text>
                <Text variant="bodyMd" as="span">
                  {' x '}
                  {current_quantity}
                </Text>
              </InlineStack>
              <InlineStack gap="200">
                <Box maxWidth="200px">
                  <Badge>{variant_title}</Badge>
                </Box>
                {charmCount > 0 && <CharmCountBadge count={charmCount} />}
              </InlineStack>
            </BlockStack>
          </Box>
        </InlineStack>
      </BlockStack>
    </Box>
  )
}

export default OrderLineItemPopoverCard
