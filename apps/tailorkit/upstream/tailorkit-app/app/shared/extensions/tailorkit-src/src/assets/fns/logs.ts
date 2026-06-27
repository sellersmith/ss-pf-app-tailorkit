/* eslint-disable max-len */
import { version, name } from '../../../package.json'

export const logMessage = (msg: string) => {
  console.log(`%c${msg}`, 'font-weight: bold; color: #000; text-decoration: underline;')
}

export const welcomeMsg = () => {
  const appName = name.split('-').join(' ').toUpperCase()
  const v = version ? `v${version}` : ''

  console.log(
    `%c${appName} ${v} 🚀`,
    'color:#FDFFFC; background:#46B930; font-size:1rem; padding:0.15rem 0.25rem; margin: 0.5rem auto; font-family: Arial; border: 2px solid #0dd8d8; border-radius: 4px; font-weight: bold; text-shadow: 1px 1px 1px #00af87bf;'
  )
  console.group('TailorKit Infor')
  logMessage('Read product-personalizer file to access global variable')
  console.groupEnd()
}

export const logError = (msg: string) => {
  console.error(`%c${msg}`, 'font-weight: bold; color: #000; text-decoration: underline;')
}
