import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import TabList from '~/components/TabList'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import IntegrateInspectorContainer from './Integrate'
import { LayerIntegrationStoreSelection } from '~/stores/modules/integration/layer-integration-selection'
import StylingIntegrationInspector from './Styling'

const IntegrationInspector = () => {
  const { t } = useTranslation()

  const clickedLayerIntegrationStore = useStore(LayerIntegrationStoreSelection, state => state.clickedLayerStore)
  const selectedTab = useStore(IntegrationStore, state => state.selectedTab)

  useEffect(() => {
    // Return to first tab if no existing clicked layer integration
    if (!clickedLayerIntegrationStore && selectedTab !== 0) {
      IntegrationStore.dispatch({
        type: 'UPDATE_SELECTED_TAB',
        payload: {
          selectedTab: 0,
        },
        skipTrace: true,
      })
    }
  }, [clickedLayerIntegrationStore, selectedTab])

  const tabs = useMemo(
    () => [
      {
        id: 'integrate-inspector',
        label: t('integrate'),
        content: <IntegrateInspectorContainer />,
      },

      ...(clickedLayerIntegrationStore
        ? [
            {
              id: 'styling-inspector',
              label: t('styling'),
              content: <StylingIntegrationInspector />,
            },
          ]
        : []),
    ],
    [clickedLayerIntegrationStore, t]
  )

  const setSelectedTab = useCallback((selectedTab: number) => {
    IntegrationStore.dispatch({
      type: 'UPDATE_SELECTED_TAB',
      payload: {
        selectedTab,
      },
      skipTrace: true,
    })
  }, [])

  return (
    <TabList
      scrollableContainerHeight={'calc(100vh - 188px)'}
      selected={selectedTab}
      items={tabs}
      setSelectedTab={selectedTab => setSelectedTab(selectedTab)}
    />
  )
}

export default IntegrationInspector
