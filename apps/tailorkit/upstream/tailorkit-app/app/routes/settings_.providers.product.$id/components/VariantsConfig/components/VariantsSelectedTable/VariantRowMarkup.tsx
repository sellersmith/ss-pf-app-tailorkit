import { IndexTable, SkeletonBodyText, Text } from '@shopify/polaris'
import { EditPriceComponent } from './EditPriceComponent'
import type { TemporaryVariant } from '~/models/TemporaryFulfillmentProducts'
import { calculateProfitMargin } from '../../fns'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import useLazyLoadItem from '~/utils/hooks/useLazyLoadItem'
import round from 'lodash/round'
import { ProductProviderStore } from '~/routes/settings_.providers.product.$id/stores/productProviderStore'
import { MAX_PROFIT_MARGIN } from '~/routes/settings_.providers.integration.$id/constants'

interface IVariantRowMarkupProps {
  variant: TemporaryVariant
  index: number
  selectedResources: string[]
  setError: (params: { [key: string]: string | undefined }) => void
  error: { [key: string]: string | undefined }
}

interface ICellProps {
  children: React.ReactNode
  isLoading: boolean
  lazyRef?: React.RefObject<HTMLDivElement>
}

/**
 * VariantRowMarkup Component
 * Renders a row in the variants table with editable price fields and lazy loading
 * @param props - Component props including variant data and selection state
 */
function VariantRowMarkup(props: IVariantRowMarkupProps) {
  const { variant, index, selectedResources, error, setError } = props
  const { title, cost, price, profitMargin } = variant
  const id = variant.id.toString()
  const { t } = useTranslation()

  // Optimize lazy loading with shorter delay for better UX
  const { ref, isLoading } = useLazyLoadItem(200)

  const handleChangeCost = useCallback(
    (cost: number) => {
      if (cost < 0) {
        setError({ [`cost-${id}`]: t('cost-cannot-be-negative') })
        return
      }
      ProductProviderStore.dispatch({ type: 'UPDATE_COST_VARIANT', payload: { variantIds: [id], cost } })
    },
    [id, setError, t]
  )

  const handleChangeProfitMargin = useCallback(
    (profitMargin: number) => {
      if (profitMargin < 0) {
        setError({ [`profitMargin-${id}`]: t('profit-margin-cannot-be-negative') })
        return
      }
      ProductProviderStore.dispatch({
        type: 'UPDATE_PROFIT_MARGIN_VARIANT',
        payload: { variantIds: [id], profitMargin: round(profitMargin, 2) },
      })
    },
    [id, setError, t]
  )

  const handleChangeFinalPrice = useCallback(
    (finalPrice: number) => {
      // Clear error if exist
      setError({ [`finalPrice-${id}`]: undefined })

      if (finalPrice < 0) {
        setError({ [`finalPrice-${id}`]: t('final-price-cannot-be-negative') })
        return
      }
      if (finalPrice < cost) {
        setError({ [`finalPrice-${id}`]: t('final-price-cannot-be-lower-than-cost') })
        return
      }

      ProductProviderStore.dispatch({ type: 'UPDATE_PRICE_VARIANT', payload: { variantIds: [id], price: finalPrice } })
    },
    [cost, id, setError, t]
  )

  const handleChangeProfit = useCallback(
    (profit: number) => {
      if (profit < 0) {
        setError({ [`profit-${id}`]: t('profit-cannot-be-negative') })
        return
      }
      const finalPrice = cost + profit
      const profitMargin = calculateProfitMargin(cost, finalPrice)
      handleChangeProfitMargin(profitMargin)
    },
    [cost, handleChangeProfitMargin, setError, id, t]
  )

  // Memoize cells to prevent unnecessary re-renders
  const cells = useMemo(
    () => [
      <MemoizedCell key="title" isLoading={isLoading} lazyRef={ref}>
        <Text as="span">{title}</Text>
      </MemoizedCell>,
      <MemoizedCell key="cost" isLoading={isLoading}>
        <EditPriceComponent
          id={`cost-${id}`}
          price={cost}
          onChangePrice={handleChangeCost}
          error={error[`cost-${id}`]}
        />
      </MemoizedCell>,
      <MemoizedCell key="profitMargin" isLoading={isLoading}>
        <EditPriceComponent
          id={`profitMargin-${id}`}
          price={profitMargin}
          onChangePrice={handleChangeProfitMargin}
          suffix="%"
          prefix=""
          maxValue={MAX_PROFIT_MARGIN}
          error={error[`profitMargin-${id}`]}
        />
      </MemoizedCell>,
      <MemoizedCell key="finalPrice" isLoading={isLoading}>
        <EditPriceComponent
          id={`finalPrice-${id}`}
          price={price}
          onChangePrice={handleChangeFinalPrice}
          error={error[`finalPrice-${id}`]}
        />
      </MemoizedCell>,
      <MemoizedCell key="profit" isLoading={isLoading}>
        <EditPriceComponent
          id={`profit-${id}`}
          price={Math.round((price - cost) * 100) / 100}
          onChangePrice={handleChangeProfit}
          error={error[`profit-${id}`]}
        />
      </MemoizedCell>,
    ],
    [
      isLoading,
      ref,
      title,
      id,
      cost,
      handleChangeCost,
      error,
      profitMargin,
      handleChangeProfitMargin,
      price,
      handleChangeFinalPrice,
      handleChangeProfit,
    ]
  )

  return (
    <IndexTable.Row id={id} key={id} selected={selectedResources.includes(id)} position={index}>
      {cells}
    </IndexTable.Row>
  )
}

export default memo(VariantRowMarkup)

export const MemoizedCell = memo(({ children, isLoading, lazyRef }: ICellProps) => {
  const content = isLoading ? <SkeletonBodyText lines={1} /> : children
  return <IndexTable.Cell>{isLoading ? <div ref={lazyRef}>{content}</div> : content}</IndexTable.Cell>
})
