const ADAPTER_MARKER = 'app-platform-live-chat-shim'

const noop = () => {
  void ADAPTER_MARKER
}

/** Disables TailorKit Crisp/live-chat side effects while preserving the copied admin call surface. */
export const Crisp = {
  chat: {
    isChatOpened() {
      return false
    },
    close: noop,
    hide: noop,
    open: noop,
    show: noop,
  },
  message: {
    show(_type?: string, _message?: string) {
      noop()
    },
    setMessageText(_message?: string) {
      noop()
    },
  },
  user: {
    getNickname() {
      return ''
    },
  },
}

export function useLiveChat() {
  return {
    initCrisp: noop,
    liveChatOpened: false,
    openChat: noop,
    openChatBox: noop,
    closeChatBox: noop,
    openChatBotAndSendUserMessage: noop,
  }
}

export function findCrispElementAndHidden() {
  noop()
  return null
}

export default useLiveChat
