import { Link as RemixLink, useLocation, useNavigate } from '@remix-run/react'
import { Crisp } from 'crisp-sdk-web'
import React from 'react'
import { findCrispElementAndHidden } from '~/bootstrap/hoc/withCrispChat'

/**
 * This React component is to fix the flashing problem when switching between routes.
 *
 * @see https://github.com/Shopify/shopify-app-template-remix/issues/369
 */
export default function CustomRemixLink({ children, to, ...rest }: any) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleNavigation = React.useCallback(
    (to: any) => {
      if (Crisp.chat.isChatOpened()) {
        Crisp.chat.close()
      }
      findCrispElementAndHidden()
      history.pushState({}, '', to)
      navigate(to)
    },
    [navigate]
  )

  return (
    <>
      <RemixLink
        key={location?.key || ''}
        to={to}
        {...rest}
        onClick={e => {
          e.preventDefault()
          handleNavigation(to)
        }}
      >
        {children}
      </RemixLink>
    </>
  )
}
