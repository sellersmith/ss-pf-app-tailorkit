import i18next, { type i18n as I18nInstance, type Resource } from 'i18next'
import { initReactI18next } from 'react-i18next'

const DEFAULT_LOCALE = 'en'
const TRANSLATION_NAMESPACE = 'translation'

type TranslationResource = Record<string, string>
type TranslationJsonModule = { default: TranslationResource }

const tailorkitCopiedRouteTranslationLoaders = {
  ar: () => import('./locales/ar.json'),
  de: () => import('./locales/de.json'),
  en: () => import('./locales/en.json'),
  es: () => import('./locales/es.json'),
  fr: () => import('./locales/fr.json'),
  hi: () => import('./locales/hi.json'),
  it: () => import('./locales/it.json'),
  ja: () => import('./locales/ja.json'),
  'pt-BR': () => import('./locales/pt-BR.json'),
  tr: () => import('./locales/tr.json'),
  vi: () => import('./locales/vi.json'),
  zh: () => import('./locales/zh.json'),
} satisfies Record<string, () => Promise<TranslationJsonModule>>

const localeResourceKeyByNormalizedLocale = new Map(
  Object.keys(tailorkitCopiedRouteTranslationLoaders).map(locale => [normalizeLocale(locale), locale])
)
const translationResourceCache = new Map<string, Promise<TranslationResource>>()

function normalizeLocale(locale?: string | null) {
  const normalized = locale?.trim().replace('_', '-').toLowerCase()
  return normalized || DEFAULT_LOCALE
}

function expandLocale(locale?: string | null) {
  const normalized = normalizeLocale(locale)
  const baseLocale = normalized.split('-')[0]
  return normalized === baseLocale ? [normalized] : [normalized, baseLocale]
}

function resolveTranslationResourceKey(locale?: string | null) {
  for (const candidate of expandLocale(locale)) {
    const resourceKey = localeResourceKeyByNormalizedLocale.get(candidate)
    if (resourceKey) return resourceKey
  }

  return DEFAULT_LOCALE
}

async function loadTranslationResource(resourceKey: string): Promise<TranslationResource> {
  const cachedResource = translationResourceCache.get(resourceKey)
  if (cachedResource) return cachedResource

  const loadResource = Promise.resolve(tailorkitCopiedRouteTranslationLoaders[resourceKey]).then(async loaderOrResource => {
    if (typeof loaderOrResource !== 'function') return loaderOrResource
    const module = await loaderOrResource()
    return module.default
  })

  translationResourceCache.set(resourceKey, loadResource)
  return loadResource
}

async function createResource(localeCandidates: string[]): Promise<Resource> {
  const resources: Resource = {}

  for (const locale of localeCandidates) {
    resources[locale] = {
      [TRANSLATION_NAMESPACE]: await loadTranslationResource(resolveTranslationResourceKey(locale)),
    }
  }

  return resources
}

export function getTailorKitCopiedRouteLocaleCandidates(locale?: string | null, instance?: I18nInstance) {
  return [
    DEFAULT_LOCALE,
    localeResourceKeyByNormalizedLocale.get(normalizeLocale(locale)),
    ...expandLocale(locale),
    localeResourceKeyByNormalizedLocale.get(normalizeLocale(instance?.language)),
    ...expandLocale(instance?.language),
    localeResourceKeyByNormalizedLocale.get(normalizeLocale(instance?.resolvedLanguage)),
    ...expandLocale(instance?.resolvedLanguage),
  ].filter((candidate, index, candidates) => Boolean(candidate) && candidates.indexOf(candidate) === index)
}

export async function addTailorKitCopiedRouteTranslationResources(instance: I18nInstance, locale?: string | null) {
  for (const candidate of getTailorKitCopiedRouteLocaleCandidates(locale, instance)) {
    const resource = await loadTranslationResource(resolveTranslationResourceKey(candidate))
    instance.addResourceBundle(candidate, TRANSLATION_NAMESPACE, resource, true, false)
  }
}

export async function ensureTailorKitCopiedRouteI18n(locale?: string | null, instance: I18nInstance = i18next) {
  const localeCandidates = getTailorKitCopiedRouteLocaleCandidates(locale, instance)

  if (!instance.isInitialized) {
    await instance.use(initReactI18next).init({
      resources: await createResource(localeCandidates),
      lng: localeCandidates[1] ?? DEFAULT_LOCALE,
      fallbackLng: DEFAULT_LOCALE,
      ns: [TRANSLATION_NAMESPACE],
      defaultNS: TRANSLATION_NAMESPACE,
      react: { useSuspense: false },
      interpolation: { escapeValue: false },
      initImmediate: false,
    })
    return instance
  }

  await addTailorKitCopiedRouteTranslationResources(instance, locale)
  return instance
}
