import { useTranslation } from 'react-i18next'
import { useChangeLanguage } from 'remix-i18next/react'

/**
 * Hook to handle app language changes
 * @param locale - The current locale from the loader
 */
export function useAppLanguage(locale: string) {
  const { i18n } = useTranslation()

  // This hook will change the `i18n` instance language to the current locale detected by the
  // loader. This way, the locale will change when we change the language, and `i18next` will
  // load the correct translation files.
  useChangeLanguage(locale)

  return { language: i18n.language }
}
