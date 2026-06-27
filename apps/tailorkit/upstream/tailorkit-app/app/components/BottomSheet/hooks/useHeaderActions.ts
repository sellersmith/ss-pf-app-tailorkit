import type { BottomSheetDrawerProps, BottomSheet, ActiveBottomSheet } from '~/components/BottomSheet'
import { BottomSheetStore, getBottomSheet, closeBottomSheetByKey } from '~/components/BottomSheet'
import { useStore } from '~/libs/external-store'
import { XIcon } from '@shopify/polaris-icons'
import omitBy from 'lodash/omitBy'
import isNil from 'lodash/isNil'
import isUndefined from 'lodash/isUndefined'
import { useCallback, useMemo } from 'react'

/**
 * Utility function to remove falsy values (null, undefined) from an object.
 * @param {object} obj - The object to filter.
 * @returns {object} The filtered object without falsy values.
 */
const removeFalsy = (obj: object) => {
  return omitBy(obj, isNil || isUndefined) || {}
}

/**
 * useHeaderActions Hook
 * Provides actions and back-navigation logic for a BottomSheet header.
 *
 * @param {object} params - Parameters for the hook.
 * @param {string} params.drawerKey - The unique key of the BottomSheet instance.
 * @param {boolean} params.autoBackAction - Whether to enable automatic back action.
 * @returns {object} An object containing `actions` and `handleGoBack` function.
 *
 * Usage:
 * ```tsx
 * const { actions, handleGoBack } = useHeaderActions({ drawerKey: 'exampleDrawer', autoBackAction: true });
 * ```
 */
export const useHeaderActions = ({
  drawerKey,
  autoBackAction = true,
}: Pick<BottomSheetDrawerProps, 'autoBackAction' | 'drawerKey'>) => {
  // Retrieve the root BottomSheet key from the store
  const rootBottomSheet = useStore(BottomSheetStore, state => state.root)

  // Retrieve the current BottomSheet instance by key
  const currentDrawer = removeFalsy(getBottomSheet(drawerKey)) as BottomSheet & ActiveBottomSheet

  /**
   * Determine if the "Back" action should target the same level of navigation.
   */
  const isBackSameLevel = useMemo(() => {
    const { previous: { drawerKey: previousKey, level: previousLevel } = {}, level } = currentDrawer
    return level === previousLevel || (level === 1 && previousKey === rootBottomSheet) || (level === 1 && !previousKey)
  }, [currentDrawer, rootBottomSheet])

  /**
   * Handles the back-navigation logic by closing the BottomSheet.
   */
  const handleGoBack = useCallback(() => {
    closeBottomSheetByKey(drawerKey)
  }, [drawerKey])

  /**
   * Define the header actions dynamically based on the navigation state.
   */
  const actions = useMemo(() => {
    if (!autoBackAction) return null

    return {
      [isBackSameLevel ? 'secondaryAction' : 'primaryAction']: {
        content: isBackSameLevel ? 'back' : '',
        icon: !isBackSameLevel ? XIcon : null,
        action: handleGoBack,
        loading: false,
      },
    }
  }, [autoBackAction, isBackSameLevel, handleGoBack])

  /**
   * Compute the return value, including actions and the back-navigation handler.
   */
  const returnValue = useMemo(() => {
    return {
      actions: !currentDrawer?.isDefault && actions,
      handleGoBack,
    }
  }, [actions, currentDrawer?.isDefault, handleGoBack])

  return returnValue
}
