import { useEffect } from 'react'
import { useStore } from '~/libs/external-store'
import { IntegrationStore } from '~/stores/modules/integration/integration'
import type { Dimension } from '~/types/template'
import { evaluateStageViewPort } from '~/utils/canvas/evaluateScale'

const useIntegrationViewport = (selector: string, dimension: Dimension) => {
  const viewport = useStore(IntegrationStore, state => state.viewport)

  const { width, height } = dimension

  useEffect(() => {
    const _viewport = evaluateStageViewPort(selector, { width, height })

    IntegrationStore.dispatch({
      type: 'UPDATE_VIEW_PORT',
      payload: { viewport: _viewport },
      skipTrace: true,
    })
  }, [height, selector, width])

  return viewport
}

export default useIntegrationViewport
