import isEmpty from 'lodash/isEmpty'
import { useEffect, useMemo } from 'react'
import { BottomSheetStore } from './store'
import type { BottomSheetDrawerProps } from './types'
import { getBottomSheet, registerBottomSheet } from './utils'
import { BottomSheet } from './components'
import { useStore } from '~/libs/external-store'

/**
 * @author: Steven Liem
 * The BottomSheetDrawer component is an interactive wrapper component that provides the basic layout
 * for a bottom sheet drawer that only work on mobile to replace the default drawer in desktop view.
 * It uses the useBottomSheet hook to manage the state of the drawer and its children.
 *
 * @param props An object containing the following properties:
 *   - id: The id of the drawer.
 *   - children: The children of the drawer.
 *   - showFooter: A boolean indicating whether the footer should be shown.
 *   - footer: The footer of the drawer.
 *   - scrollable: A boolean indicating whether the drawer should be scrollable.
 *   - filters: The filters of the drawer.
 *   - drawerKey: The key of the drawer.
 *   - level: The level of the drawer.
 *   - useBackdrop: A boolean indicating whether the drawer should use a backdrop.
 *   - onBack: A function that is called when the user clicks the back button.
 */
export function BottomSheetDrawer(props: BottomSheetDrawerProps) {
  const { drawerKey } = props

  const active = useStore(BottomSheetStore, state => state.active)

  useEffect(() => {
    if (drawerKey) {
      registerBottomSheet(drawerKey, props)
    }
  }, [drawerKey, props])

  const drawer = useMemo(() => {
    return getBottomSheet(drawerKey || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, drawerKey])

  if (isEmpty(drawer)) {
    return null
  }

  return <BottomSheet {...props} activeDrawer={drawer as any} isShowing={drawer.isActive} />
}
