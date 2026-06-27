// utils/loadCSS.js
const loadCSS = (href: string) => {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.href = href
    link.rel = 'stylesheet'
    link.onload = () => resolve(true)
    link.onerror = () => reject(new Error('CSS failed to load'))
    document.head.appendChild(link)
  })
}

export default loadCSS
