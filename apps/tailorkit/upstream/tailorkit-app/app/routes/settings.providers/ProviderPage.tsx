/* eslint-disable max-len */
import { useNavigate } from '@remix-run/react'
import {
  Banner,
  BlockStack,
  Button,
  Card,
  ChoiceList,
  EmptyState,
  type IndexFiltersProps,
  InlineStack,
  Text,
} from '@shopify/polaris'
import { Fragment, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ListTable from '~/components/ListTable'
import { ILLUSTRATORS } from '~/constants/assets-url'
import { type ProviderDocument } from '~/models/Provider'
import { ProviderProductsSelector } from './ProviderProductsSelector'
import { UnfinishedImportNotification } from './UnfinishedImportNotification'
import { useTourGuide } from '~/bootstrap/hoc/withTourGuide'
import { fetchUnfinishedImportedProducts } from './utilities/checkUnfinishedImportedProducts'
import { buildUrlWithParams } from '~/utils/buildUrlWithParams'
import ConnectionWarningModal from './modals/ConnectionWarningModal'
import { checkValidConnection } from './utilities/checkValidConnection'
import useDevices from '~/utils/hooks/useDevice'
import { useRootLoaderData } from '~/root'
import { EHelpLinks } from '~/constants/enum'
import RowMarkupDesktop from './RowMarkupDesktop'
import RowMarkupMobile from './RowMarkupMobile'

function ProviderPage(props: { views: any[] }) {
  const { views } = props
  const { t } = useTranslation()

  const navigate = useNavigate()

  const { tour } = useTourGuide()

  const { isMobileView } = useDevices()

  const defaultProviderProductModal = {
    active: false,
    providerId: '',
    providerName: '',
    isImporting: true,
  }

  const [providerProductModal, setProviderProductModal] = useState<{
    active: boolean
    providerId: string
    providerName: string
    isImporting: boolean
  }>(defaultProviderProductModal)
  const [connectionWarningModal, setConnectionWarningModal] = useState({
    active: false,
    providerId: '',
    providerName: '',
  })

  const [loading, setLoading] = useState(false)

  const onNavigateToConnect = useCallback(
    (providerId: string, name: string) => {
      const url = buildUrlWithParams(`/settings/providers/connection/${providerId}`, {
        name,
        ...(tour ? { tour } : {}),
      })

      navigate(url)
    },
    [navigate, tour]
  )

  const handleCheckValidConnection = useCallback((providerId: string, providerName: string) => {
    return checkValidConnection(providerId, providerName)
  }, [])

  const onImportHandler = useCallback(
    async (_id: string, name: string) => {
      setLoading(true)

      // Check the connection is valid
      const isValidConnection = await handleCheckValidConnection(_id, name)

      if (!isValidConnection) {
        setLoading(false)
        setConnectionWarningModal({
          active: true,
          providerId: _id,
          providerName: name,
        })

        return
      }

      // Check if there are products before
      const existProductsBefore = await fetchUnfinishedImportedProducts({ providerId: _id })
      setLoading(false)

      setProviderProductModal({
        active: true,
        providerId: _id,
        providerName: name,
        isImporting: !existProductsBefore,
      })
    },
    [handleCheckValidConnection]
  )

  // Define resource name
  const resourceName = useMemo(
    () => ({
      singular: t('provider'),
      plural: t('providers'),
    }),
    [t]
  )

  const headings = useMemo(
    () => [
      {
        id: 'logo',
        title: (
          <Text as={'span'} visuallyHidden>
            {t('logo')}
          </Text>
        ),
      },
      {
        id: 'name',
        title: t('name'),
      },
      {
        id: 'introduce',
        title: t('introduce'),
      },
      {
        id: 'api-key',
        title: t('connect-api-key'),
      },
      {
        id: 'import-products',
        title: t('import-products'),
      },
      {
        id: 'api-status',
        title: t('api-status'),
      },
    ],
    [t]
  )
  // Define options for filtering option sets
  const filters = useMemo(
    () => [
      {
        key: 'connectStatus',
        label: t('api-status'),
        filter: {
          Component: ChoiceList,
          props: {
            titleHidden: true,
            allowMultiple: false,
            title: t('api-status'),
            choices: [
              { value: 'connected', label: t('connected') },
              { value: 'disconnected', label: t('disconnected') },
            ],
          },
        },
        shortcut: true,
      },
    ],
    [t]
  )

  // Define options for sorting providers
  const sortOptions: IndexFiltersProps['sortOptions'] = useMemo(
    () => [
      { label: t('name'), value: 'name asc', directionLabel: t('a-z') },
      { label: t('name'), value: 'name desc', directionLabel: t('z-a') },
    ],
    [t]
  )

  // Define function to render filter label
  const renderFilterLabel = useCallback(
    (key: string, value: string | any[]): string => {
      switch (key) {
        case 'connectStatus':
          return `${t('api-status')}: ${t(value).toLowerCase()}`

        default:
          return value as string
      }
    },
    [t]
  )

  // Generate markup for empty state
  const emptyState = useMemo(
    () => (
      <BlockStack gap={'500'}>
        <Card roundedAbove="sm">
          <BlockStack align="center">
            <EmptyState heading={t('no-data-yet')} image={ILLUSTRATORS.EMPTY_TEMPLATE}>
              <BlockStack gap={'200'}>
                <Text variant="bodyMd" as="p" tone="subdued">
                  {t('data-subtext')}
                </Text>
              </BlockStack>
            </EmptyState>
          </BlockStack>
        </Card>
      </BlockStack>
    ),
    [t]
  )

  // Define function to render row markup
  const renderRowMarkup = useCallback(
    (provider: ProviderDocument & { connectStatus?: 'connected' | 'disconnect' }, index: number) => {
      return isMobileView ? (
        <RowMarkupMobile
          provider={provider}
          index={index}
          onNavigateToConnect={onNavigateToConnect}
          onImportHandler={onImportHandler}
          loading={loading}
        />
      ) : (
        <RowMarkupDesktop
          provider={provider}
          index={index}
          onNavigateToConnect={onNavigateToConnect}
          onImportHandler={onImportHandler}
          loading={loading}
        />
      )
    },
    [isMobileView, loading, onImportHandler, onNavigateToConnect]
  )

  const onContinueToEdit = () => {
    navigate(`/settings/providers/integration/${providerProductModal.providerId}`)
    setProviderProductModal({ ...providerProductModal, active: false })
  }

  const onContinueToImport = () => {
    setProviderProductModal({ ...providerProductModal, isImporting: true })
  }

  // Check if any providers is required to be connected to TailorKit?
  const { shopData } = useRootLoaderData()

  const requiredFulfillmentServices = useMemo(
    () => shopData?.appConfig?.requiredFulfillmentServices,
    [shopData?.appConfig?.requiredFulfillmentServices]
  )

  return (
    <Fragment>
      <BlockStack gap="400">
        {requiredFulfillmentServices?.Printify > 0 && (
          <Banner tone="critical" title={t('action-required-connect-to-provider')}>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                {t(
                  'you-have-pending-orders-that-need-fulfillment-please-connect-to-printify-now-to-process-them-automatically-and-avoid-delays'
                )}
              </Text>

              <InlineStack>
                <Button onClick={() => window.open(EHelpLinks.HOW_TO_GET_API_KEY)}>
                  {t('learn-how-to-connect-provider')}
                </Button>
              </InlineStack>
            </BlockStack>
          </Banner>
        )}

        <ListTable
          queryKey="name"
          condensed={isMobileView}
          selectable={false}
          disableStickyMode={isMobileView}
          sort={['name asc']}
          dataSource="/api/providers"
          t={t}
          views={views}
          filters={filters}
          headings={headings}
          emptyState={emptyState}
          sortOptions={sortOptions}
          resourceName={resourceName}
          renderRowMarkup={renderRowMarkup}
          renderFilterLabel={renderFilterLabel}
        />
      </BlockStack>

      {providerProductModal.active ? (
        providerProductModal.isImporting ? (
          <ProviderProductsSelector
            providerName={providerProductModal.providerName}
            active={providerProductModal.active}
            providerId={providerProductModal.providerId}
            onClose={() => {
              setProviderProductModal(defaultProviderProductModal)
            }}
          />
        ) : (
          <UnfinishedImportNotification
            active={providerProductModal.active}
            onContinueToEdit={onContinueToEdit}
            onContinueToImport={onContinueToImport}
            onClose={() => {
              setProviderProductModal(defaultProviderProductModal)
            }}
          />
        )
      ) : null}

      <ConnectionWarningModal
        active={connectionWarningModal.active}
        onClose={() =>
          setConnectionWarningModal({
            ...connectionWarningModal,
            active: false,
          })
        }
        onReviewConnection={() => {
          onNavigateToConnect(connectionWarningModal.providerId, connectionWarningModal.providerName)
          setConnectionWarningModal({
            ...connectionWarningModal,
            active: false,
          })
        }}
      />
    </Fragment>
  )
}

export default ProviderPage
