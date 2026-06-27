import { Box, IndexTable, Thumbnail, Text, Link, Button, Badge } from '@shopify/polaris'
import { useTranslation } from 'react-i18next'
import type { ProviderDocument } from '~/models/Provider'

interface RowMarkupDesktopProps {
  provider: ProviderDocument & { connectStatus?: 'connected' | 'disconnect' }
  index: number
  onNavigateToConnect: (id: string, name: string) => void
  onImportHandler: (id: string, name: string) => void
  loading: boolean
}

export default function RowMarkupDesktop(props: RowMarkupDesktopProps) {
  const { t } = useTranslation()
  const { provider, index, onNavigateToConnect, onImportHandler, loading } = props
  const { _id, name, logoUrl, description, detailsUrl, connectStatus = 'disconnect' } = provider
  const isConnected = connectStatus === 'connected'

  return (
    <IndexTable.Row id={_id} key={_id} position={index}>
      <IndexTable.Cell>
        <Thumbnail source={logoUrl} alt={name} />
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Text as="p" variant="bodyMd">
          {name}
        </Text>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Box maxWidth="350px" width="350px">
          <div style={{ whiteSpace: 'normal' }}>
            <Text as="dd" variant="bodyMd" breakWord>
              {description}{' '}
              <Link url={detailsUrl} target="_blank">
                {t('view-details')}
              </Link>
            </Text>
          </div>
        </Box>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Button id={_id} accessibilityLabel={name} onClick={() => onNavigateToConnect(_id, name)}>
          {isConnected ? t('edit') : t('connect')}
        </Button>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Button
          id={`import-${name.toLowerCase()}-products-btn`}
          disabled={!isConnected}
          onClick={() => onImportHandler(_id, name)}
          loading={loading}
        >
          {t('import')}
        </Button>
      </IndexTable.Cell>

      <IndexTable.Cell>
        <Badge tone={isConnected ? 'success' : 'enabled'}>{t(connectStatus)}</Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  )
}
