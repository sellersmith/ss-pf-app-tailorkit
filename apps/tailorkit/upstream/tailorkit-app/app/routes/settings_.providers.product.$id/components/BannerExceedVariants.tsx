import type { BannerHandles } from '@shopify/polaris'
import { Banner, BlockStack, List, Text } from '@shopify/polaris'
import type { Dispatch, SetStateAction } from 'react'
import { memo, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

interface IBannerExceedVariantsProps {
  errors: string[]
  dismissed: boolean
  setDismissed: Dispatch<SetStateAction<boolean>>
}

const getBannerTitle = (errorLength: number, t: (key: string, options?: any) => string): string => {
  return errorLength > 1
    ? t('there-are-num-errors-with-this-product', { num: errorLength })
    : t('there-is-one-error-with-this-product')
}

const ErrorList = memo(({ errors }: { errors: string[] }) => {
  const { t } = useTranslation()

  if (errors.length === 1) {
    return (
      <Text as="p" variant="bodyMd">
        {t(errors[0])}
      </Text>
    )
  }

  return (
    <List type="bullet">
      {errors.map((error, index) => (
        <List.Item key={`error-${index}`}>{t(error)}</List.Item>
      ))}
    </List>
  )
})

ErrorList.displayName = 'ErrorList'

function BannerExceedVariants({ errors, dismissed, setDismissed }: IBannerExceedVariantsProps) {
  const { t } = useTranslation()
  const banner = useRef<BannerHandles>(null)

  const onDismissHandler = useCallback(() => {
    setDismissed(true)
  }, [setDismissed])

  useEffect(() => {
    // Focus to banner
    banner.current?.focus()
  }, [])

  if (dismissed || errors.length === 0) return null

  const bannerTitle = getBannerTitle(errors.length, t)

  return (
    <Banner ref={banner} title={bannerTitle} tone="critical" onDismiss={onDismissHandler}>
      <BlockStack>
        <ErrorList errors={errors} />
      </BlockStack>
    </Banner>
  )
}

export default memo(BannerExceedVariants)
