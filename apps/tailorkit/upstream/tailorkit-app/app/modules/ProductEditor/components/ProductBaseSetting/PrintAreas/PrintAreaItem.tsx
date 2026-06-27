import { TextField } from '@shopify/polaris'
import { useCallback, useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_DEMO_SPRINT_NAME_SIZE } from '~/constants/integration'
import { INTEGRATION_SCREEN_ERRORS } from '~/modules/ProductEditor/constants'
import withMockup, { type WithVariantsProps } from '~/modules/ProductEditor/withMockup'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import type { PrintArea } from '~/types/integration'
import { IntegrationEditorContext } from '../../../contexts'
import { checkIsImportedProduct } from '~/modules/ProductEditor/utilities/getVariantMetafields'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'

export default withMockup(function PrintAreaItem(props: { printArea: PrintArea } & WithVariantsProps) {
  const { printArea, mockupId, variants } = props
  const { t } = useTranslation()
  const { getValidationErrors, setValidationErrors } = useContext(IntegrationEditorContext)

  const { _id, name } = printArea
  const [tempName, setTempName] = useState(name)

  const _keyError = `${_id}:${INTEGRATION_SCREEN_ERRORS.PRINT_AREA_NAME_IS_REQUIRED}`
  const [keyError, setKeyError] = useState(_keyError)

  const firstVariant = variants[0]
  const isImportedProduct = checkIsImportedProduct(firstVariant.product)

  const onChangeLayerName = useCallback(
    (skipTrace?: boolean) => {
      const value = tempName.trim()
      if (value.length > MAX_DEMO_SPRINT_NAME_SIZE) return

      const invalidValue = !value || (typeof value === 'string' && !value)

      const duplicatedValue = IntegrationStore.getState()
        .variants.filter(variant => variant.mockup._id === mockupId)
        .map(variant => variant.printAreas.filter(printArea => printArea._id !== _id).map(printArea => printArea.name))
        .flat()
        .includes(value)

      if (invalidValue) {
        setValidationErrors(mockupId, keyError, INTEGRATION_SCREEN_ERRORS.PRINT_AREA_NAME_IS_REQUIRED)
      } else if (duplicatedValue) {
        const error = INTEGRATION_SCREEN_ERRORS.PRINT_AREA_NAME_EXISTED
        const keyError = `${_id}:${error}`

        setKeyError(keyError)

        setValidationErrors(mockupId, keyError, error)
      } else if (getValidationErrors(mockupId, keyError)) {
        setValidationErrors(mockupId, keyError, null)
      }

      IntegrationStore.dispatch({
        type: 'UPDATE_PRINT_AREA_NAME',
        payload: {
          mockupId,
          printAreaId: _id,
          name: value,
        },
        skipTrace,
      })
    },
    [tempName, getValidationErrors, mockupId, keyError, _id, setValidationErrors]
  )

  const error = getValidationErrors(mockupId, keyError)

  if (isImportedProduct) {
    return null
  }

  return (
    <TextField
      maxLength={MAX_DEMO_SPRINT_NAME_SIZE}
      autoComplete="off"
      showCharacterCount
      value={tempName}
      label={t('personalization-area-title')}
      placeholder={t('front').toLowerCase()}
      type="text"
      error={error || undefined}
      onChange={setTempName}
      onBlur={() => onChangeLayerName()}
      onFocus={() => {
        // When focusing the print area name, also select the first layer belonging to it
        const variant = IntegrationStore.getState().variants.find(v => v.mockup._id === mockupId)
        const layers: any[] = variant?.mockup?.layers || []
        const targetLayerStore = layers.find(ls => ls?.getState?.().printAreaId === _id)

        if (targetLayerStore) {
          LayerIntegrationStoreSelection.dispatch({
            type: 'SET_LAYER_STORE_SELECTION',
            payload: { clickedLayerStore: targetLayerStore },
          })
        }
      }}
      disabled={isImportedProduct}
    />
  )
})
