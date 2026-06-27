import { Fragment, useEffect } from 'react'
import { USER_JOURNEY_ACTIONS } from '~/routes/api.user-journey/constants'
import { dismissCardForever } from '~/routes/dashboard/utilities/dismissCardForever'
import { authenticatedFetch } from '~/shopify/fns.client'

export default function withWindowVariables<T extends React.ElementType>(Component: T, tour_id?: string) {
  return function WithWindowVariables(props: React.ComponentProps<T>) {
    useEffect(() => {
      // Define the window variables
      // TODO: Temporary to test, remove this when release please.
      window.deleteOnboardingTour = async (type: string) => {
        try {
          const res = await authenticatedFetch(
            `/api/user-journey?action=${USER_JOURNEY_ACTIONS.CLEAR_ONBOARDING_DATA}`,
            {
              method: 'POST',
              body: JSON.stringify({
                type,
              }),
            }
          )
          if (res.success) {
            console.log('Deleted')
          }
        } catch (err) {
          console.error('Failed to save progress onboarding ', err)
        }
      }
      window.deleteAppConfig = async (appConfigKey: string) => {
        try {
          const res = await dismissCardForever(appConfigKey, true)
          if (res) {
            console.log('Deleted')
          }
        } catch (err) {
          console.error('Failed to delete app config', err)
        }
      }
    }, [])

    return (
      <Fragment>
        <Component {...props} />
      </Fragment>
    )
  }
}
