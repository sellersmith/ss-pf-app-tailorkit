import { useMemo } from 'react'
import { useGroupProductBase } from '~/stores/modules/integration/integration'
import type { IProductBaseContainerProps } from '.'
import ProductVariant from './ProductVariant'

function ProductVariants(props: IProductBaseContainerProps) {
  const { scrollableRef, previewMode } = props
  const groupProductBase = useGroupProductBase()
  const groupKeys = useMemo(() => Object.keys(groupProductBase), [groupProductBase])

  return (
    <s-box>
      {groupKeys.map((key, index) => {
        const variants = groupProductBase[key]

        return (
          <s-stack key={key} id={`${variants[0]._id}-container`}>
            <s-box>
              <ProductVariant variants={variants} scrollableRef={scrollableRef} previewMode={previewMode} />
            </s-box>

            {index !== groupKeys.length - 1 && <s-divider borderColor="border" />}
          </s-stack>
        )
      })}
    </s-box>
  )
}

export default ProductVariants
