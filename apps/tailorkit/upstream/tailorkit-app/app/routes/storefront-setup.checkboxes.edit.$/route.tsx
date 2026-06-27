import { useLoaderData } from '@remix-run/react'
import { useCallback, useEffect, useState } from 'react'
import { CheckboxForm } from '../storefront-setup.checkboxes/components'
import { useRootLoaderData } from '~/root'
import { getUpsellProductLimit } from '~/utils/getUpsellProductLimit'
import type { loader } from './loader.server'
import themeHelperStyles from 'extensions/onetick-src/src/onetick.css?url'
import richTextEditorStyles from '~/components/.client/RichTextEditor/styles.css?url'
import reactQuillStyles from 'react-quill-new/dist/quill.snow.css?url'
import { SkeletonCheckboxEdit } from '~/components/skeleton/Pages'

// Re-export loader and action from separate files
export { loader } from './loader.server'
export { action } from './action.server'

export const links = () => [
  { rel: 'stylesheet', href: themeHelperStyles },
  { rel: 'stylesheet', href: reactQuillStyles },
  { rel: 'stylesheet', href: richTextEditorStyles },
]

export function HydrateFallback() {
  return <SkeletonCheckboxEdit />
}

type AppConfig = {
  isOS2Theme?: boolean
  checkboxBlockLinkProduct?: string
  checkboxBlockLinkCart?: string
  enabledOneTickHelper?: boolean
  oneTickHelperLink?: string
}

export default function CheckboxEditRoute() {
  const loaderData = useLoaderData<typeof loader>()
  const rootData = useRootLoaderData()
  const upsellProductLimit = getUpsellProductLimit(rootData?.shopData)

  // Lazily fetch theme config via API call
  const [appConfig, setAppConfig] = useState<AppConfig | undefined>(undefined)
  const [isLoadingAppConfig, setIsLoadingAppConfig] = useState(true)

  // Reusable function to fetch theme config
  const fetchThemeConfig = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/preferences?themeConfig=true')
      const data = await response.json()
      if (data?.appConfig) {
        setAppConfig({
          isOS2Theme: data.appConfig.isOS2Theme,
          checkboxBlockLinkProduct: data.appConfig.checkboxBlockLinkProduct,
          checkboxBlockLinkCart: data.appConfig.checkboxBlockLinkCart,
          enabledOneTickHelper: data.appConfig.enabledOneTickHelper,
          oneTickHelperLink: data.appConfig.oneTickHelperLink,
        })
        return data.appConfig.enabledOneTickHelper ?? false
      }
      return false
    } catch (error) {
      console.error('Failed to fetch theme config:', error)
      return false
    } finally {
      setIsLoadingAppConfig(false)
    }
  }, [])

  // Fetch theme config once on mount
  useEffect(() => {
    fetchThemeConfig()
  }, [fetchThemeConfig])

  return (
    <CheckboxForm
      mode="edit"
      checkbox={loaderData.checkbox}
      collections={loaderData.collections}
      tags={loaderData.tags}
      vendors={loaderData.vendors}
      productTypes={loaderData.productTypes}
      checkboxStyling={loaderData.checkboxStyling}
      appConfig={appConfig}
      isLoadingAppConfig={isLoadingAppConfig}
      onRefreshAppConfig={fetchThemeConfig}
      upsellProductLimit={upsellProductLimit}
      isUpsellProductIntegrated={loaderData.isUpsellProductIntegrated}
    />
  )
}
