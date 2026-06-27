import { useCallback } from 'react'
import { useRootLoaderData } from '~/root'
import { createOptionPricing } from '~/utils/exchange-rates/client'
import { IMAGELESS_OPTION_TYPE } from '~/types/psd'
import type { TLayerStore } from '~/stores/modules/layer'

interface ImagelessPricingHandlerProps {
  layerStore: TLayerStore
  optionSet: any
  onStateUpdate: (newState: any) => void
}

export function useImagelessPricing({ layerStore, optionSet, onStateUpdate }: ImagelessPricingHandlerProps) {
  const { shopData } = useRootLoaderData()
  const currency = shopData?.shopConfig?.currency || 'USD'

  const onChangeImagelessPricingById = useCallback(
    async (_id: string, value: string) => {
      const numericValue = +value

      try {
        const newPricing = await createOptionPricing(numericValue, currency)
        const values = optionSet?.data?.[IMAGELESS_OPTION_TYPE] || []

        // Update the specific imageless option's pricing
        const updatedValues = values.map((option: any) =>
          option._id === _id ? { ...option, additionalPricing: newPricing } : option
        )

        layerStore.dispatch({
          type: 'UPDATE_OPTION_SET',
          payload: {
            optionSet: {
              ...optionSet,
              data: {
                ...optionSet.data,
                [IMAGELESS_OPTION_TYPE]: updatedValues,
              },
            },
          },
        })

        onStateUpdate({ optionSet: layerStore.getState().optionSet })
      } catch (error) {
        console.error('Error updating option pricing:', error)
      }
    },
    [layerStore, optionSet, currency, onStateUpdate]
  )

  return { onChangeImagelessPricingById }
}
