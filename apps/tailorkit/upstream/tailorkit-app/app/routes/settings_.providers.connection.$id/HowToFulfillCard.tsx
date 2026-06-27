/* eslint-disable jsx-a11y/anchor-has-content */
import { BlockStack, Link, List, Text } from '@shopify/polaris'
import { Trans, useTranslation } from 'react-i18next'
import { EPROVIDER } from '~/constants/fulfillment-providers'

export default function HowToFulfillCard(props: { providerName: string }) {
  const { t } = useTranslation()
  const { providerName } = props

  if (providerName === EPROVIDER.PRINTIFY) {
    return (
      <BlockStack>
        <List type="number">
          <List.Item>
            <Trans
              t={t}
              components={{
                url: (
                  <Link
                    url="https://try.printify.com/tailorkit"
                    target="_blank"
                    accessibilityLabel={t('sign-up-for-a-free-printify-account')}
                    removeUnderline
                  />
                ),
              }}
            >
              {t('get-a-url-free-printify-account-url')}
            </Trans>
          </List.Item>

          <List.Item>
            <Trans
              t={t}
              components={{
                url: (
                  <Link
                    url="https://printify.com/app/auth/login"
                    target="_blank"
                    accessibilityLabel={t('log-in-to-your-printify-account')}
                    removeUnderline
                  />
                ),
              }}
            >
              {t('url-log-in-url-to-your-printify-account')}
            </Trans>
          </List.Item>

          <List.Item>
            <Trans
              t={t}
              components={{
                url: (
                  <Link
                    url="https://printify.com/app/account/my-stores"
                    target="_blank"
                    accessibilityLabel={t('add-store')}
                    removeUnderline
                  />
                ),
              }}
            >
              {t('url-add-store-url-on-printfy')}
            </Trans>
          </List.Item>

          <List.Item>
            <BlockStack>
              <Text as="p" variant="bodyMd">
                {t('generate-a-personal-access-token')}
              </Text>
              <ol
                className="Polaris-List Polaris-List--spacingLoose"
                style={{ paddingLeft: '0', listStyleType: 'none' }}
              >
                <li className="Polaris-List__Item">
                  <Trans
                    t={t}
                    components={{
                      url: (
                        <Link
                          url="https://printify.com/app/account/api"
                          target="_blank"
                          accessibilityLabel={t('generate-api-key')}
                          removeUnderline
                        />
                      ),
                    }}
                  >
                    {t('a-url-generate-api-key-url-all-scopes')}
                  </Trans>
                </li>

                <li className="Polaris-List__Item">
                  <Trans
                    t={t}
                    components={{
                      b: <b></b>,
                    }}
                  >
                    {t('b-copy-created-token-and-paste-to-api-token-input-in-b-access-api-key-b')}
                  </Trans>
                </li>

                <li className="Polaris-List__Item">
                  <Text as="p" variant="bodyMd">
                    {t('c-test-api-key')}
                  </Text>
                </li>
              </ol>
            </BlockStack>
          </List.Item>

          <List.Item>
            <Trans
              t={t}
              components={{
                b: <b></b>,
              }}
            >
              {t('select-a-store-to-send-to-order-in-b-connected-store-b')}
            </Trans>
          </List.Item>

          <List.Item>{t('save')}</List.Item>
        </List>
      </BlockStack>
    )
  }

  return null
}
