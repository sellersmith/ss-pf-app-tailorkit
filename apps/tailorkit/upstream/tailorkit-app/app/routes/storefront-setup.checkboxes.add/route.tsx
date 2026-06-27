import { useLoaderData } from '@remix-run/react'
import { CheckboxForm } from '../storefront-setup.checkboxes/components'
import type { loader } from './loader.server'
import themeHelperStyles from 'extensions/onetick-src/src/onetick.css?url'
import richTextEditorStyles from '~/components/.client/RichTextEditor/styles.css?url'
import reactQuillStyles from 'react-quill-new/dist/quill.snow.css?url'

// Re-export loader and action from separate files
export { loader } from './loader.server'
export { action } from './action.server'

export const links = () => [
  { rel: 'stylesheet', href: themeHelperStyles },
  { rel: 'stylesheet', href: reactQuillStyles },
  { rel: 'stylesheet', href: richTextEditorStyles },
]

export default function CheckboxAddRoute() {
  const loaderData = useLoaderData<typeof loader>()

  return (
    <CheckboxForm
      mode="add"
      collections={loaderData.collections}
      tags={loaderData.tags}
      vendors={loaderData.vendors}
      productTypes={loaderData.productTypes}
      checkboxStyling={loaderData.checkboxStyling}
      upsellProductLimit={loaderData.upsellProductLimit}
    />
  )
}
