import { useLocation, useNavigate } from '@remix-run/react'
import type { ComponentClass, FunctionComponent } from 'react'
import { useEffect } from 'react'
import type { WithTranslationProps } from 'react-i18next'

/**
 * HOC for navigating to template editor when search params includes template id
 *
 * @param Component FunctionComponent | ComponentClass
 * @returns
 */
export function withNavigateTemplateListing(
  Component: FunctionComponent<WithTranslationProps> | ComponentClass<WithTranslationProps>
) {
  return function WithNavigateTemplateListing(props: React.ComponentProps<typeof Component>) {
    const location = useLocation()

    const navigate = useNavigate()

    useEffect(() => {
      const test = location.search.match(/[?&]id=([^&]+)/)

      if (test) {
        navigate(`/templates/${test[1]}`)
      }
    }, [location, navigate])

    return <Component {...props} />
  }
}
