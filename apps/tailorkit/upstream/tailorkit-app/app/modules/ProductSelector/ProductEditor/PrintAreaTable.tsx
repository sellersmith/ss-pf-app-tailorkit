import type { NonEmptyArray } from '@shopify/polaris/build/ts/src/types'
import type { PrintAreaTableProps } from '~/modules/ProductSelector/type'
import type { IndexTableHeading } from '@shopify/polaris/build/ts/src/components/IndexTable/IndexTable'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { IndexTable, TextField } from '@shopify/polaris'

export default function PrintAreaTable({ variants }: PrintAreaTableProps) {
  const { t } = useTranslation()

  // Table headings
  const headings = [{ title: t('variant') }, { title: t('area') }, { title: t('width') }, { title: t('height') }]

  // Item count
  const itemCount = useMemo(() => variants.length * variants[0].placeholders.length, [variants])

  // Table rows
  const rowMarkup = useMemo(
    () =>
      variants.map(({ id, title, placeholders }, vIndex) => (
        <>
          {placeholders?.map(({ position, width, height }, pIndex) => (
            <IndexTable.Row
              id={`${id}-${position}`}
              key={`${id}-${position}`}
              position={vIndex * placeholders.length + pIndex}
            >
              <IndexTable.Cell>
                <TextField disabled labelHidden label={title} value={title} autoComplete="off" />
              </IndexTable.Cell>

              <IndexTable.Cell>
                <TextField disabled labelHidden label={position} value={position} autoComplete="off" />
              </IndexTable.Cell>

              <IndexTable.Cell>
                <TextField disabled labelHidden label={width} value={`${width}`} autoComplete="off" />
              </IndexTable.Cell>

              <IndexTable.Cell>
                <TextField disabled labelHidden label={height} value={`${height}`} autoComplete="off" />
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </>
      )),
    [variants]
  )

  return (
    <IndexTable selectable={false} itemCount={itemCount} headings={headings as NonEmptyArray<IndexTableHeading>}>
      {rowMarkup}
    </IndexTable>
  )
}
