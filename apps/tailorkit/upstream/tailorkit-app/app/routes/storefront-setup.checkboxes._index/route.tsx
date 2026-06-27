import { useLoaderData } from '@remix-run/react'
import { ClientOnly } from 'remix-utils/client-only'
import CheckboxesIndexRouteClient from './components'
import type { loader } from './loader.server'

// Re-export loader and action from separate files
export { loader } from './loader.server'
export { action } from './action.server'

export default function CheckboxesIndexRoute() {
  const { checkboxCount, upsellProductLimit } = useLoaderData<typeof loader>()

  return (
    <ClientOnly fallback={null}>
      {() => <CheckboxesIndexRouteClient checkboxCount={checkboxCount} upsellProductLimit={upsellProductLimit} />}
    </ClientOnly>
  )
}
