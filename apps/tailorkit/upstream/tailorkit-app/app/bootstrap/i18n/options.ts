export default {
  debug: false,
  fallbackLng: 'en',
  // defaultNS: 'index',
  /**
   * Some issue with tFunction when try to call translate(t)('key', { lng: 'some-language' })
   * So we need to preload the translation for some-language
   * Follow this issue: https://github.com/i18next/i18next/issues/1416#issuecomment-829692089
   */
  preload: ['en'],
  react: { useSuspense: false },
  supportedLngs: ['en', 'ar', 'it', 'es', 'de', 'ja', 'vi', 'zh', 'fr', 'hi', 'pt-BR', 'tr'],
}
