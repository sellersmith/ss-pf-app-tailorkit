import { Outlet, Scripts } from '@remix-run/react'

/**
 * This public component serving for non-admin route
 * It doesn't require Polaris or Admin utilities
 */
export default function PublicRoot() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
