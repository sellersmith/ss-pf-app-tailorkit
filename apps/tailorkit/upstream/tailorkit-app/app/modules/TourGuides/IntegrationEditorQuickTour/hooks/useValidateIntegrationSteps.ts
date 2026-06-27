import { useCallback, useEffect, useState } from 'react'
import { authenticatedFetch } from '~/shopify/fns.client'

const TIME_TO_INTERVAL_FACTOR = 2000

export const useValidateIntegrationSteps = () => {
  const [appBlock, setAppBlock] = useState({ enabledAppBlock: false, customizerLink: '' })

  const fetchAppBlockStatus = useCallback(async () => {
    const shop = await authenticatedFetch('/api/preferences?themeConfig=true')
    const { appConfig } = shop || {}
    const { enabledAppBlock, customizerLink } = appConfig || {}

    return { enabledAppBlock, customizerLink }
  }, [])

  const validateInstallAppBlockStep = useCallback(
    (validCallback: () => void, invalidCallback: () => void) => {
      if (!appBlock.enabledAppBlock) {
        const checkAppBlockIsEnabled = async () => {
          const { enabledAppBlock } = await fetchAppBlockStatus()

          if (enabledAppBlock) {
            clearInterval(timer)
            setAppBlock({ ...appBlock, enabledAppBlock: true })
            validCallback()
          } else {
            invalidCallback()
          }
        }

        const timer = setInterval(checkAppBlockIsEnabled, TIME_TO_INTERVAL_FACTOR)

        invalidCallback()
        return
      }

      validCallback()
    },
    [appBlock, fetchAppBlockStatus]
  )

  useEffect(() => {
    ;(async () => {
      if (!appBlock.enabledAppBlock) {
        const { enabledAppBlock, customizerLink } = await fetchAppBlockStatus()
        setAppBlock({ enabledAppBlock, customizerLink })
      }
    })()
  }, [appBlock.enabledAppBlock, fetchAppBlockStatus])

  return {
    appBlock,
    validateInstallAppBlockStep,
  }
}
