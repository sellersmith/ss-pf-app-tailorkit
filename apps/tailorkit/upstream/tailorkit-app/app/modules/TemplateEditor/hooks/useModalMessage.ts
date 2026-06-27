import { useEffect } from 'react'
import { MODAL_ID } from '~/constants/modal'
import { modalStore } from '~/stores/modal'

export function useModalMessage() {
  useEffect(() => {
    function handleMessageFromMainApp(ev: MessageEvent) {
      if (ev.data === 'SAVE_TEMPLATE') {
        modalStore.dispatch({
          type: 'OPEN_MODAL',
          payload: {
            key: MODAL_ID.SAVE_TEMPLATE_MODAL,
          },
        })
      }
    }

    window.addEventListener('message', handleMessageFromMainApp)

    return () => window.removeEventListener('message', handleMessageFromMainApp)
  }, [])
}
