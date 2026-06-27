import { BlockStack, Checkbox, Select, TextField } from '@shopify/polaris'
import { useState } from 'react'
import { useStore } from '~/libs/external-store'
import { TEMPLATE_DESIGN_TYPE } from '~/routes/api.templates_designs/constants'
import { TemplateEditorStore } from '~/stores/modules/template'
import { useShopDomain } from '~/utils/shopify/useShopParams'

export default function TemplateDesignTypeSelector() {
  const shopDomain = useShopDomain()

  const templateCategory = useStore(TemplateEditorStore, state => state.category)

  const [isTemplateForShop, setIsTemplateForShop] = useState(!!templateCategory)

  const templateCategoryOptions = [
    {
      label: 'Family',
      value: TEMPLATE_DESIGN_TYPE.FAMILY,
    },
    {
      label: 'Love',
      value: TEMPLATE_DESIGN_TYPE.LOVE,
    },
    {
      label: 'Friends',
      value: TEMPLATE_DESIGN_TYPE.FRIENDS,
    },
    {
      label: 'Pets',
      value: TEMPLATE_DESIGN_TYPE.PETS,
    },
    {
      label: 'Others',
      value: TEMPLATE_DESIGN_TYPE.OTHERS,
    },
  ]

  const presetCategories = [
    TEMPLATE_DESIGN_TYPE.FAMILY,
    TEMPLATE_DESIGN_TYPE.LOVE,
    TEMPLATE_DESIGN_TYPE.FRIENDS,
    TEMPLATE_DESIGN_TYPE.PETS,
  ]

  const isPresetCategory = presetCategories.includes((templateCategory || '') as TEMPLATE_DESIGN_TYPE)
  const selectValue = isPresetCategory ? templateCategory || TEMPLATE_DESIGN_TYPE.OTHERS : TEMPLATE_DESIGN_TYPE.OTHERS

  function handleChangeTemplateCategory(selected: string | undefined): void {
    if (selected === TEMPLATE_DESIGN_TYPE.OTHERS) {
      // Switch to custom category input; clear stored category for user input
      TemplateEditorStore.dispatch({ type: 'SET_CATEGORY', payload: { category: '' } })
      return
    }

    TemplateEditorStore.dispatch({ type: 'SET_CATEGORY', payload: { category: selected } })
  }

  function handleChangeIsTemplateForShop(checked: boolean): void {
    setIsTemplateForShop(checked)
    // Default to custom category flow when enabled
    handleChangeTemplateCategory(checked ? TEMPLATE_DESIGN_TYPE.OTHERS : '')
  }

  if (window.PUBLIC_ENV.STORE_ASSET_DOMAIN === shopDomain) {
    return (
      <BlockStack gap={'200'}>
        <Checkbox
          label={'I want to create a template for my shop'}
          checked={isTemplateForShop}
          onChange={handleChangeIsTemplateForShop}
        />
        {isTemplateForShop && (
          <>
            <Select
              label={'Select template type'}
              options={templateCategoryOptions}
              value={selectValue}
              onChange={handleChangeTemplateCategory}
            />
            {selectValue === TEMPLATE_DESIGN_TYPE.OTHERS && (
              <TextField
                label={'Custom category'}
                autoComplete="off"
                value={isPresetCategory ? '' : templateCategory || ''}
                onChange={(val: string) =>
                  TemplateEditorStore.dispatch({ type: 'SET_CATEGORY', payload: { category: val } })
                }
              />
            )}
          </>
        )}
      </BlockStack>
    )
  }
  return null
}
