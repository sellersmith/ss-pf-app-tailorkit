import { IndexTable, TextField } from '@shopify/polaris'
import type { IPlaceholder } from './PrintAreaTable'
import useLazyLoadItem from '~/utils/hooks/useLazyLoadItem'
import { useMemo } from 'react'
import { MemoizedCell } from './VariantsConfig/components/VariantsSelectedTable/VariantRowMarkup'

interface IPrintAreaTableCell {
  placeholder: IPlaceholder
  index: number
}

function PrintAreaTableCell(props: IPrintAreaTableCell) {
  const { placeholder, index } = props

  const { variantName, position, width, height } = placeholder
  const id = index.toString()

  const { ref, isLoading } = useLazyLoadItem(200)

  const cells = useMemo(
    () => [
      <MemoizedCell key="variantName" isLoading={isLoading} lazyRef={ref}>
        <TextField disabled value={variantName} autoComplete="off" label={variantName} labelHidden />
      </MemoizedCell>,
      <MemoizedCell key="position" isLoading={isLoading}>
        <TextField disabled value={position} autoComplete="off" label={position} labelHidden />
      </MemoizedCell>,
      <MemoizedCell key="width" isLoading={isLoading}>
        <TextField disabled value={width.toString()} autoComplete="off" label={width} labelHidden />
      </MemoizedCell>,
      <MemoizedCell key="height" isLoading={isLoading}>
        <TextField disabled value={height.toString()} autoComplete="off" label={height} labelHidden />
      </MemoizedCell>,
    ],
    [height, isLoading, position, ref, variantName, width]
  )

  return (
    <IndexTable.Row key={id} id={id} position={index}>
      {cells}
    </IndexTable.Row>
  )
}

export default PrintAreaTableCell
