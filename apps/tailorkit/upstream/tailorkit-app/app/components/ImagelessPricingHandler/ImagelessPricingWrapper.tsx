import React from 'react'
import { useImagelessPricing } from './useImagelessPricing'
import type { TLayerStore } from '~/stores/modules/layer'

interface ImagelessPricingWrapperProps {
  layerStore: TLayerStore
  optionSet: any
  onStateUpdate: (newState: any) => void
  children: (pricingHandler: {
    onChangeImagelessPricingById: (id: string, value: string) => Promise<void>
  }) => React.ReactNode
}

export default function ImagelessPricingWrapper({
  layerStore,
  optionSet,
  onStateUpdate,
  children,
}: ImagelessPricingWrapperProps) {
  const pricingHandler = useImagelessPricing({ layerStore, optionSet, onStateUpdate })

  return <>{children(pricingHandler)}</>
}
