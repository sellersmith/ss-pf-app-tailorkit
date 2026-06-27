export const sendMessageToModal = (modalId: string, message: string) => {
  const modal: any = document.getElementById(modalId)
  modal.contentWindow.postMessage(message, window.location.origin)
}

export const sendMessageToMainApp = (message: string) => {
  const targetOrigin = window.location.origin

  // Always broadcast to opener (parent admin shell)
  if (window.opener && window.opener !== window) {
    window.opener.postMessage(message, targetOrigin)
  }

  // ALSO broadcast inside the current iframe so sibling components (e.g. AI Chat) receive it
  window.postMessage(message, targetOrigin)
}
