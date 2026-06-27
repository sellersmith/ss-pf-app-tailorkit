import { ECardPlacement } from '~/components/TourGuide/constants'
import type { GuidedTourFlow } from '~/components/TourGuide/types'
import { USER_JOURNEY_TYPE } from '~/routes/api.user-journey/constants'
import { modalStoreActions } from '~/stores/modal'
import type { TourFlowProps } from '.'
import { MODAL_ID } from '../modal'
import { ONE_SECOND_IN_MILLISECONDS } from '..'

const { openModal } = modalStoreActions

function renderProviderTour(props: TourFlowProps): GuidedTourFlow {
  const { t, navigate } = props

  // const providerTourTutorialLink = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

  return {
    id: USER_JOURNEY_TYPE.PROVIDER_TOUR,
    steps: [
      {
        id: 'provider-tour-1',
        element: 'tbody > tr > td:nth-child(4) > button',
        title: t('provider-tour-title-1'),
        // helpText: t('provider-tour-tutorial-link', { link: providerTourTutorialLink }),
        placement: ECardPlacement.BOTTOM_CENTER,
        autoProgressive: ['tbody > tr > td:nth-child(4) > button'],
        recursiveQuery: 1000,
        arrowSelector: 'tbody > tr > td:nth-child(4) > button',
        arrowConfig: {
          placement: ECardPlacement.TOP_CENTER,
          startPosition: 'top',
          offset: [-15, -15],
        },
        onNext: () => {
          const indicator = document.querySelector('tbody > tr > td:nth-child(4) > button')

          if (!indicator) {
            return
          }

          const buttonElement = indicator as HTMLButtonElement

          buttonElement?.click()
        },
      },
      {
        id: 'provider-tour-2',
        element: '#fulfillment-description',
        title: t('provider-tour-title-2'),

        // helpText: t('provider-tour-tutorial-link', { link: providerTourTutorialLink }),
        placement: ECardPlacement.RIGHT_CENTER,
        recursiveQuery: 1000,
        stageRadius: 0,
        arrowSelector: '#fulfillment-description',
        arrowConfig: {
          placement: ECardPlacement.LEFT_CENTER,
          startPosition: 'left',
          offset: [-10, 0],
        },
      },
      {
        id: 'provider-tour-3',
        element: '#api-token-card',
        title: t('provider-tour-title-3', { link: 'https://printify.com/app/account/api' }),
        // helpText: t('provider-tour-tutorial-link', { link: providerTourTutorialLink }),
        placement: ECardPlacement.LEFT_CENTER,
        arrowSelector: '#api-token-card input',
        arrowConfig: {
          placement: ECardPlacement.TOP_CENTER,
          startPosition: 'top',
          offset: [-10, -10],
        },
        disableNextUntil: () => {
          const buttonTestAPI = document.querySelector('#test-api-key-btn')

          // Disable next button until the button has tone success icon
          return buttonTestAPI?.querySelector('.Polaris-Icon.Polaris-Icon--toneSuccess') !== null
        },
      },
      {
        id: 'provider-tour-4',
        element: '#select-a-store-selection',
        title: t('provider-tour-title-4'),

        // helpText: t('provider-tour-tutorial-link', { link: providerTourTutorialLink }),
        placement: ECardPlacement.BOTTOM_CENTER,
        arrowSelector: '#select-a-store-selection',
        arrowConfig: {
          placement: ECardPlacement.TOP_CENTER,
          startPosition: 'top',
          offset: [0, -5],
        },
        disableNextUntil: () => {
          const storeConnectionContainer = document.querySelector('#store-selection-container')

          // Disable next button until the store connection container has store id
          return !!storeConnectionContainer?.getAttribute('aria-label')
        },
      },
      {
        id: 'provider-tour-5',
        element: '#auto-fulfillment-card',
        title: t('provider-tour-title-5'),
        content: t('provider-tour-content-5'),
        // helpText: t('provider-tour-tutorial-link', { link: providerTourTutorialLink }),
        placement: ECardPlacement.LEFT_TOP,
      },
      {
        id: 'provider-tour-6',
        element: '#save-provider-connection',
        title: t('provider-tour-title-6'),
        // helpText: t('provider-tour-tutorial-link', { link: providerTourTutorialLink }),
        autoProgressive: true,
        placement: ECardPlacement.TOP_CENTER,
        onNext: () => {
          const saveButton = document.querySelector('#save-provider-connection') as HTMLButtonElement

          if (!saveButton) {
            return
          }

          saveButton.click()

          // Watch until the save button is enabled
          const isSaveButtonEnabled = () => {
            return saveButton.getAttribute('aria-label') === 'enabled'
          }

          let count = 0

          const interval = setInterval(() => {
            if (count > 100) {
              clearInterval(interval)
              return
            }

            if (isSaveButtonEnabled()) {
              setTimeout(() => {
                // Navigate to main provider screen
                navigate('/settings/providers')

                // Open modal congratulations
                setTimeout(() => {
                  openModal(MODAL_ID.PROVIDER_TOUR_CONGRATULATIONS_MODAL)
                }, ONE_SECOND_IN_MILLISECONDS)
              }, ONE_SECOND_IN_MILLISECONDS * 2)

              // Clear interval
              clearInterval(interval)
            }

            count++
          }, 100)
        },
      },
    ],
  }
}

export default renderProviderTour
