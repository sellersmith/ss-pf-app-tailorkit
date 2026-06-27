import { BlockStack, Box, Button, Checkbox, Divider, InlineStack, Text } from '@shopify/polaris'
import { capitalizeFirstLetter } from 'extensions/tailorkit-src/src/assets/fns/capitalize-first-letter'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TemporaryVariant } from '~/models/TemporaryFulfillmentProducts'
import { BLUE_PRINTS_INFOR, type IGroupProviderVariants } from '../hooks/usePrintifyVariants'
import { VariantsSelectedTable } from './VariantsSelectedTable'
import { useStore } from '~/libs/external-store'
import { ProductProviderStore } from '~/routes/settings_.providers.product.$id/stores/productProviderStore'

interface IQuickActionSelectVariantsProps {
  groupVariants: IGroupProviderVariants
  getVariantsSelected: (groupProviderVariants: IGroupProviderVariants) => TemporaryVariant[]
}

export const QuickActionSelectVariants = (props: IQuickActionSelectVariantsProps) => {
  const { groupVariants, getVariantsSelected } = props
  const { t } = useTranslation()
  const [_groupVariants, setGroupVariants] = useState<IGroupProviderVariants>(groupVariants)
  const [selectAll, setSelectAll] = useState<Record<string, boolean>>({})

  const currentVariants = useStore(ProductProviderStore, state => state.variants)
  const baseProfitMargin = useStore(ProductProviderStore, state => state.baseProfitMargin)
  const productProviderId = useStore(ProductProviderStore, state => state.productProviderId)

  const groupCurrentVariants = useMemo(
    () =>
      currentVariants.reduce((group: any, variant) => {
        if (!group[variant.id]) {
          group[variant.id] = variant
        }

        return group
      }, {}),
    [currentVariants]
  )

  const updater = (updatedGroup: IGroupProviderVariants) => {
    setGroupVariants(updatedGroup)

    let _variants = getVariantsSelected(updatedGroup)
    const minPriceOfAllVariants = BLUE_PRINTS_INFOR[productProviderId]?.min_price / 100 || 0

    _variants = _variants.map(_variant => {
      const currentVariant = groupCurrentVariants[_variant.id]

      if (currentVariant) {
        const cost = currentVariant.cost || minPriceOfAllVariants
        return {
          ..._variant,
          cost,
          price: currentVariant.price || cost,
          profitMargin: currentVariant.profitMargin || baseProfitMargin,
        }
      }

      return _variant
    })

    ProductProviderStore.dispatch({
      type: 'SET_VARIANTS',
      payload: { variants: _variants },
    })
  }
  /**
   * Toggle select-all for a variant group.
   * Updates all variants in the group to match the new selection state.
   * @param newCheck - Boolean indicating new selection state.
   * @param vKey - Key of the variant group being modified.
   */
  const handleChangeSelectAll = (newCheck: boolean, vKey: string) => {
    setSelectAll(prevSelectAll => ({ ...prevSelectAll, [vKey]: newCheck }))

    const updatedGroup = {
      ..._groupVariants,
      [vKey]: _groupVariants[vKey].map((variant, index) => {
        const [key] = Object.keys(variant)
        return { [key]: index === 0 && !newCheck ? true : newCheck }
      }),
    }

    updater(updatedGroup)
  }

  /**
   * Toggle selection state for an individual variant within a group.
   * Prevents unselecting the last remaining selected variant.
   * @param params - Object containing newCheck, variantValue, and variantKey.
   */
  const handleSelectVariant = (params: { newCheck: boolean; variantValue: string; variantKey: string }) => {
    const { newCheck, variantValue, variantKey } = params
    const updatedGroup = { ..._groupVariants }

    const blockUnselect = updatedGroup[variantKey]
      .filter(variant => Object.keys(variant)[0] !== variantValue)
      .every(variant => !Object.values(variant)[0])

    updatedGroup[variantKey] = updatedGroup[variantKey].map(variant => {
      const [key] = Object.keys(variant)
      return key === variantValue && !blockUnselect ? { [key]: newCheck } : variant
    })

    const shouldSelectAll = updatedGroup[variantKey].every(variant => Object.values(variant)[0])
    setSelectAll(prevSelectAll => ({ ...prevSelectAll, [variantKey]: shouldSelectAll }))
    updater(updatedGroup)
  }

  useEffect(() => {
    setGroupVariants(groupVariants)
  }, [groupVariants])

  return (
    <BlockStack gap="200">
      {Object.entries(_groupVariants).map(([vKey, variantValueArr], index) => (
        <BlockStack gap="100" key={index}>
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="bodyMd" as="span">
              {capitalizeFirstLetter(vKey)}
            </Text>
            <Checkbox
              label={t('select-all')}
              checked={selectAll[vKey] || variantValueArr.every(variant => Object.values(variant)[0])}
              id={vKey}
              onChange={checked => handleChangeSelectAll(checked, vKey)}
            />
          </InlineStack>
          <InlineStack gap="200">
            {variantValueArr.map(variantValue => {
              const [value, isSelected] = Object.entries(variantValue)[0]

              return (
                <div className={`variant-select-button ${isSelected ? 'active' : ''}`} key={value}>
                  <Button
                    onClick={() =>
                      handleSelectVariant({ newCheck: !isSelected, variantValue: value, variantKey: vKey })
                    }
                  >
                    {value}
                  </Button>
                </div>
              )
            })}
          </InlineStack>
        </BlockStack>
      ))}
      <Box paddingBlockStart={'100'}>
        <Divider borderColor="border" />
      </Box>
      <VariantsSelectedTable _groupVariants={_groupVariants} />
    </BlockStack>
  )
}
