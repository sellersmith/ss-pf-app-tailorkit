import {
  Box,
  IndexTable,
  Text,
  Link,
  Button,
  Badge,
  BlockStack,
  InlineStack,
  Popover,
  ActionList,
} from '@shopify/polaris'
import { MenuHorizontalIcon } from '@shopify/polaris-icons'
import { useTranslation } from 'react-i18next'
import type { ProviderDocument } from '~/models/Provider'
import { useCallback, useState } from 'react'

interface RowMarkupMobileProps {
  provider: ProviderDocument & { connectStatus?: 'connected' | 'disconnect' }
  index: number
  onNavigateToConnect: (id: string, name: string) => void
  onImportHandler: (id: string, name: string) => void
  loading: boolean
}

export default function RowMarkupMobile(props: RowMarkupMobileProps) {
  const { t } = useTranslation()
  const { provider, index, onNavigateToConnect, onImportHandler } = props
  const { _id, name, description, detailsUrl, connectStatus = 'disconnect' } = provider
  const isConnected = true // connectStatus === 'connected'
  const [active, setActive] = useState(false)

  const togglePopover = useCallback(() => {
    setActive(prev => !prev)
  }, [])

  return (
    <IndexTable.Row id={_id} key={_id} position={index}>
      <IndexTable.Cell>
        <Box width="calc(100vw - 24px)">
          <InlineStack gap="200" blockAlign="center" wrap={false} align="space-between">
            <BlockStack gap="100">
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                {name}
              </Text>
              <Box>
                <Badge tone={isConnected ? 'success' : 'enabled'}>{t(connectStatus)}</Badge>
              </Box>
              <div style={{ whiteSpace: 'normal', maxWidth: 'calc(100vw - 68px)' }}>
                <Text as="dd" variant="bodyMd" breakWord>
                  {description}{' '}
                  <Link url={detailsUrl} target="_blank">
                    {t('view-details')}
                  </Link>
                </Text>
              </div>
            </BlockStack>
            {!isConnected ? (
              <Button id={_id} accessibilityLabel={name} onClick={() => onNavigateToConnect(_id, name)}>
                {t('connect')}
              </Button>
            ) : (
              <Popover
                active={active}
                onClose={togglePopover}
                activator={<Button icon={MenuHorizontalIcon} onClick={togglePopover} />}
              >
                <ActionList
                  items={[
                    {
                      content: t('edit-provider'),
                      onAction: () => onNavigateToConnect(_id, name),
                    },
                    {
                      content: t('import-products'),
                      onAction: () => onImportHandler(_id, name),
                    },
                  ]}
                />
              </Popover>
            )}
          </InlineStack>
        </Box>
      </IndexTable.Cell>
    </IndexTable.Row>
  )
}
