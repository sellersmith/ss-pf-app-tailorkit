import { PRINT_ID_PREFIX } from 'extensions/tailorkit-src/src/assets/constants'
import { DisplayFulfillmentStatus } from '~/models/Order.d'
import { getEnumKeysByValues } from '~/utils/typescript'
import { BADGE_STATUS } from './components/status'
import { capitalizeFirstLetter } from '~/bootstrap/fns/misc'
import { authenticatedFetch } from '~/shopify/fns.client'
import { ORDER_ACTION } from '../api.orders/constants'
import { useNavigate } from '@remix-run/react'
import { useCallback, useState } from 'react'
import { sleep } from '~/utils/sleep'
import { TWO_SECONDS } from '~/constants/time'
import { showGenericErrorToast } from '~/utils/toastEvents'
import { useRootLoaderData } from '~/root'

type GroupedPrintOptions = {
  [printAreaLabel: string]: {
    [optionSetLabel: string]: string
  }
}

type GroupedPropertiesByPrintAreas = {
  [printAreaLabel: string]: { name: string; value: string }[]
}

/**
 * Group options/properties for elegantly displaying properties and printing images
 *
 * @param params
 * @returns
 */

// TODO: Write unit test for this core function
// Currently, staging branch haven't set up vitest yet
export function groupOptionsByPrintAreaAndOptionSet(params: {
  options: { name: string; value: string; _id?: string }[]
  PROPERTY_PREFIX: string
  layers?: any[]
  printAreas?: any[]
}): { grouped: GroupedPrintOptions; propertiesGroupedByPrintAreas: GroupedPropertiesByPrintAreas } {
  const { layers, options, printAreas, PROPERTY_PREFIX } = params
  const grouped: GroupedPrintOptions = {}

  const propertiesGroupedByPrintAreas: GroupedPropertiesByPrintAreas = {}

  options.forEach(({ name, value }) => {
    const isDefaultProperty = name === `_${PROPERTY_PREFIX}`

    // Skip default property
    if (isDefaultProperty) {
      return
    }

    if (getValidPropertyNamePrefix(name, PROPERTY_PREFIX)) {
      // Group print area prop in case print id prefix not include
      if (!name.includes(PRINT_ID_PREFIX)) {
        const [, printAreaId, optionSetId] = name.split(' ')
        const printAreaLabel = printAreas?.find(printArea => printArea._id === printAreaId)?.name

        const matchedLayer = layers?.find(
          layer => (layer.type === 'text' && layer._id === optionSetId) || layer.optionSet?._id === optionSetId
        )

        // Check if the layer is a text layer and has content or label
        const isTextLayer = matchedLayer?.type === 'text'
        const isExistingContentOrLabel = matchedLayer && (matchedLayer.settings?.content || matchedLayer.label)

        const optionSetLabel = isTextLayer ? isExistingContentOrLabel : matchedLayer?.optionSet?.label

        grouped[printAreaLabel || printAreaId] = Object.assign(grouped[printAreaLabel || printAreaId] || {}, {
          [optionSetLabel || optionSetId]: value,
        })
      }
      // Show display with option include print id prefix
      else {
        const labelMatch = name.match(new RegExp(`${PROPERTY_PREFIX} (.*?)\\s+(?=${PRINT_ID_PREFIX})`)) // Match after '_PF' up to 'printID'
        const idMatch = name.match(new RegExp(`${PRINT_ID_PREFIX}:(.+)`)) // Match after 'printID:'

        // The first capture group (matches[1]) corresponds to the property name (e.g., `Hat #1`).
        const propName = labelMatch ? labelMatch[1] : ''

        // The second capture group (matches[1]) corresponds to the print ID (e.g., `84f809e6-6f5a-49a0-aaff-9b1466f5e08b`).
        const printAreaId = idMatch ? idMatch[1] : ''

        const printAreaLabel = printAreas?.find(printArea => printArea._id === printAreaId)?.name
        const propId = printAreaLabel || printAreaId

        if (!propertiesGroupedByPrintAreas[propId]) {
          propertiesGroupedByPrintAreas[propId] = []
        }

        propertiesGroupedByPrintAreas[propId].push({ name: propName, value })
      }
    }
    // Remain a fallback display for old order
    else if (name.includes('printID')) {
      const [propName, printAreaId] = name.split(' printID:')
      const printAreaLabel = printAreas?.find(printArea => printArea._id === printAreaId)?.name
      const propId = printAreaLabel || printAreaId

      if (!propertiesGroupedByPrintAreas[propId]) {
        propertiesGroupedByPrintAreas[propId] = []
      }
      propertiesGroupedByPrintAreas[propId].push({ name: propName, value })
    } else {
      // Do nothing
      // Exclude all redundant properties and cart display name
    }
  })

  return { grouped, propertiesGroupedByPrintAreas }
}

/**
 * Get badge status for the order
 *
 * @param status string
 * @returns
 */
export function getBadgeStatus(status: string) {
  // Get enum keys by their values
  const { IN_PROGRESS, UNFULFILLED, REQUEST_DECLINED, FULFILLED } = getEnumKeysByValues(DisplayFulfillmentStatus, [
    'IN_PROGRESS',
    'UNFULFILLED',
    'REQUEST_DECLINED',
    'FULFILLED',
  ])

  switch (true) {
    case ['fulfilled', FULFILLED].includes(status):
      return BADGE_STATUS.SUCCESS
    case ['inprogress', 'partial', 'partially-fulfilling', 'partiallyfulfilled', 'scheduled', IN_PROGRESS].includes(
      status
    ):
      return BADGE_STATUS.INFO
    case ['restocked', 'unfulfilled', UNFULFILLED, REQUEST_DECLINED].includes(status):
      return BADGE_STATUS.ATTENTION
    default:
      return BADGE_STATUS.NONE
  }
}

/**
 * Format order status for more readable
 *
 * @param status
 * @returns
 */
export function formatOrderStatus(status: string) {
  return capitalizeFirstLetter(status.replace(/[-_]/g, ' ').toLocaleLowerCase())
}

/**
 * Hook for requesting fulfillment order
 *
 * @returns { onRequestFulfillment: (order: any, vendor: string) => Promise<void>}
 */

export const useRequestFulfillment = () => {
  const navigate = useNavigate()
  const { shopData } = useRootLoaderData()

  const [requestingFulfillment, setRequestingFulfillment] = useState(false)

  const requestFulfillOrder = useCallback(async (orderIds: number | number[], vendor?: string) => {
    const response = await authenticatedFetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: ORDER_ACTION.FULFILL,
        ...(vendor ? { vendor } : {}),
        selectedResources: typeof orderIds === 'number' ? [orderIds] : orderIds,
      }),
    })

    return response
  }, [])

  const handleRefresh = useCallback(() => {
    navigate('.', { replace: true })
  }, [navigate])

  const onRequestFulfillment = useCallback(
    async (orderIds: number | number[], vendor?: string) => {
      try {
        // Check if the provider is required to be connected to TailorKit
        if (vendor && shopData?.appConfig?.requiredFulfillmentServices?.[vendor] > 0) {
          navigate(`/settings/providers`)
          return
        }

        setRequestingFulfillment(true)

        // Submit order
        await requestFulfillOrder(orderIds, vendor)

        await sleep(TWO_SECONDS)

        // End loading
        setRequestingFulfillment(false)

        setTimeout(() => {
          // Refresh after requesting fulfillment
          handleRefresh()
        }, TWO_SECONDS)
      } catch (e) {
        console.error(e)

        showGenericErrorToast()

        await sleep(TWO_SECONDS)

        // End loading
        setRequestingFulfillment(false)

        setTimeout(() => {
          // Refresh after requesting fulfillment
          handleRefresh()
        }, TWO_SECONDS)
      }
    },
    [shopData?.appConfig?.requiredFulfillmentServices, requestFulfillOrder, navigate, handleRefresh]
  )

  return {
    requestingFulfillment,
    onRequestFulfillment,
  }
}

/**
 * Get valid property name prefix
 *
 * @param propertyName
 * @param propertyPrefix
 * @returns
 */
export function getValidPropertyNamePrefix(propertyName: string, propertyPrefix: string) {
  /** @important: Must have a space after the property prefix */
  const prefix = `_${propertyPrefix}`
  const suffix = ' '
  const startWithString = `${prefix}${suffix}`

  // A Property name can start with the property prefix or be the property prefix itself
  // Ex: _PF Hat #1 or _PF only
  return propertyName.startsWith(startWithString) || propertyName === prefix
}
