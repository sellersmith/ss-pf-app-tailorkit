import { BlockStack, Card, Select, Text } from '@shopify/polaris'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useNavigation, useSearchParams } from '@remix-run/react'
import useDevices from '~/utils/hooks/useDevice'
import SettingLayout from '~/routes/settings/components/SettingLayout'
import { useSettingsSaveBar } from '~/routes/settings/contexts/SettingsSaveBarContext'
import { showToast } from '~/utils/toastEvents'
import { TOAST } from '~/constants/toasts'

// Language configuration with flag emojis and display names
// Sorted alphabetically by English name
const SUPPORTED_LANGUAGES = {
  zh: { flag: '🇨🇳', name: '中文' },
  de: { flag: '🇩🇪', name: 'Deutsch' },
  en: { flag: '🇺🇸', name: 'English' },
  es: { flag: '🇪🇸', name: 'Español' },
  fr: { flag: '🇫🇷', name: 'Français' },
  it: { flag: '🇮🇹', name: 'Italiano' },
  'pt-BR': { flag: '🇧🇷', name: 'Português (BR)' },
  vi: { flag: '🇻🇳', name: 'Tiếng Việt' },
  tr: { flag: '🇹🇷', name: 'Türkçe' },
  ar: { flag: '🇸🇦', name: 'العربية' },
  hi: { flag: '🇮🇳', name: 'हिंदी' },
  ja: { flag: '🇯🇵', name: '日本語' },
} as const

type SupportedLanguageCode = keyof typeof SUPPORTED_LANGUAGES

interface LanguageSwitcherProps {
  className?: string
}

export default function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const [searchParams] = useSearchParams()
  const { isMobileView } = useDevices()
  const [draftLanguage, setDraftLanguage] = useState<SupportedLanguageCode | null>(null)
  const { setPendingChanges, setSaving, registerSaveHandler, registerDiscardHandler } = useSettingsSaveBar()

  const currentLanguage = i18n.language as SupportedLanguageCode
  const selectedLanguage = draftLanguage ?? currentLanguage
  const hasPendingChanges = draftLanguage !== null && draftLanguage !== currentLanguage
  const isSaving = navigation.state !== 'idle'

  // Generate select options with flags and names
  const languageOptions = useMemo(() => {
    return Object.entries(SUPPORTED_LANGUAGES).map(([code, { flag, name }]) => ({
      label: `${flag} ${name}`,
      value: code,
    }))
  }, [])

  const handleLanguageChange = useCallback((languageCode: string) => {
    setDraftLanguage(languageCode as SupportedLanguageCode)
  }, [])

  const handleDiscard = useCallback(() => {
    setDraftLanguage(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!draftLanguage || draftLanguage === currentLanguage || isSaving) return

    try {
      showToast(t(TOAST.COMMON.LANGUAGE_UPDATING))
      const newSearchParams = new URLSearchParams(searchParams)
      newSearchParams.set('lng', draftLanguage)

      navigate(`/settings/preferences?${newSearchParams.toString()}`, {
        replace: true,
      })
      setPendingChanges(false)
      showToast(t(TOAST.COMMON.LANGUAGE_UPDATED))
    } catch (error) {
      console.error('Failed to change language:', error)
      showToast(t(TOAST.COMMON.ERROR_GENERIC), { isError: true })
      setPendingChanges(false)
    }
  }, [currentLanguage, draftLanguage, isSaving, navigate, searchParams, t, setPendingChanges])

  // Register save/discard handlers with context
  useEffect(() => {
    registerSaveHandler(handleSave)
    registerDiscardHandler(handleDiscard)
  }, [handleSave, handleDiscard, registerSaveHandler, registerDiscardHandler])

  // Sync pending changes state with context
  useEffect(() => {
    setPendingChanges(hasPendingChanges)
  }, [hasPendingChanges, setPendingChanges])

  // Sync saving state with context
  useEffect(() => {
    setSaving(isSaving)
  }, [isSaving, setSaving])

  return (
    <SettingLayout title={t('language')}>
      <div className={className}>
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="200">
              <Text as="span" variant="bodyMd" tone="subdued">
                {t('choose-your-preferred-language-for-the-tailorkit-interface')}
              </Text>
            </BlockStack>

            {isMobileView ? (
              <Select
                label=""
                labelHidden
                options={languageOptions}
                value={selectedLanguage}
                onChange={handleLanguageChange}
                disabled={isSaving}
              />
            ) : (
              <Select
                label={t('select-language')}
                labelHidden
                options={languageOptions}
                value={selectedLanguage}
                onChange={handleLanguageChange}
                disabled={isSaving}
              />
            )}

            {isSaving && (
              <Text as="p" variant="bodySm" tone="subdued">
                {t('changing-language')}...
              </Text>
            )}
          </BlockStack>
        </Card>
      </div>
    </SettingLayout>
  )
}
