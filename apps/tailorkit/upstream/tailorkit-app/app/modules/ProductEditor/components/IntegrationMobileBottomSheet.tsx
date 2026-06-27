import { Fragment, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheetDrawer, BottomSheetStore } from '~/components/BottomSheet'
import { useStore } from '~/libs/external-store'
import ProductBaseSetting from './ProductBaseSetting'
import { INTEGRATION_EDITOR_DRAWER_KEYS } from '../constants'

export default function IntegrationMobileBottomSheet() {
  const { t } = useTranslation()

  // Initialize drawer config for integrations editor on mount
  useEffect(() => {
    BottomSheetStore.dispatch({
      type: 'SET_BOTTOM_SHEET',
      payload: {
        bottomSheets: {
          ...BottomSheetStore.getState().bottomSheets,
          [INTEGRATION_EDITOR_DRAWER_KEYS.INTEGRATION_EDITOR]: {
            ...BottomSheetStore.getState().bottomSheets[INTEGRATION_EDITOR_DRAWER_KEYS.INTEGRATION_EDITOR],
            expandOnActive: false,
            defaultClose: true,
          },
        },
        active: {
          [INTEGRATION_EDITOR_DRAWER_KEYS.INTEGRATION_EDITOR]: {
            drawerKey: INTEGRATION_EDITOR_DRAWER_KEYS.INTEGRATION_EDITOR,
            isActive: false,
          },
        },
      },
    })
  }, [])

  // Title for the bottom sheet
  const title = t('personalization')

  // Watch store to ensure component re-renders with active drawer changes
  useStore(BottomSheetStore, state => state.active)

  return (
    <Fragment>
      <BottomSheetDrawer
        title={title}
        drawerKey={INTEGRATION_EDITOR_DRAWER_KEYS.INTEGRATION_EDITOR}
        autoBackAction={false}
        useBackdrop={true}
        scrollable
      >
        <ProductBaseSetting />
      </BottomSheetDrawer>
    </Fragment>
  )
}
