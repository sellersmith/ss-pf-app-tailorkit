import { Box, SkeletonBodyText, IndexTable } from '@shopify/polaris'

export const TableLoadingSkeleton = (props: { numberOfCols: number }) => {
  const { numberOfCols } = props

  return (
    <>
      {Array(numberOfCols)
        .fill(null)
        .map((_, index) => {
          return (
            <IndexTable.Cell key={index}>
              <Box padding={'300'}>
                <SkeletonBodyText lines={1} />
              </Box>
            </IndexTable.Cell>
          )
        })}
    </>
  )
}
