import { BlockStack, Box } from '@shopify/polaris'

export const ThumbnailSkeleton = ({
  quantity = 20,
  stylesImageItem,
}: {
  quantity?: number
  stylesImageItem?: React.CSSProperties
}) => {
  return (
    <>
      {Array(quantity)
        .fill(null)
        .map((_, index) => {
          return (
            <Box key={index} padding={'300'}>
              <BlockStack align="center" inlineAlign="center" gap={'100'}>
                <Box
                  width={stylesImageItem?.width ? stylesImageItem.width.toString() : '100px'}
                  minHeight="100px"
                  background="bg-surface-brand-active"
                  borderRadius="200"
                ></Box>
              </BlockStack>
            </Box>
          )
        })}
    </>
  )
}
