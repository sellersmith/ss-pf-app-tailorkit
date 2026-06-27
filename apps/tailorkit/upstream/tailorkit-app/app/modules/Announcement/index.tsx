import type { ErrorInfo, ReactNode } from 'react'
import type { AnnouncementComponentProps, AnnouncementComponentState, AnnouncementDocument } from './types'
import { PureComponent } from 'react'
import { Banner, BlockStack, Text } from '@shopify/polaris'

export default class AnnouncementComponent<P, S> extends PureComponent<
  P & AnnouncementComponentProps,
  S & AnnouncementComponentState
> {
  declare props: P & AnnouncementComponentProps

  static defaultProps: AnnouncementComponentProps = {}

  state: S & AnnouncementComponentState = {
    announcements: [],
  }

  static getDerivedStateFromError(error: Error): any {
    return { error }
  }

  constructor(props: P & AnnouncementComponentProps) {
    super(props)

    if (props.dataSource) {
      const fetchFunction = props.fetchFunction || fetch

      fetchFunction(props.dataSource).then(async (res: any) => {
        const announcements = typeof res.json === 'function' ? await res.json() : res

        if (announcements?.length) {
          this.setState({ announcements })
        }
      })
    }
  }

  render(): ReactNode {
    const { t } = this.props
    const { announcements } = this.state

    return (
      announcements?.length > 0
      && announcements.map((announcement: AnnouncementDocument, index: number) => (
        <Banner key={index} tone={announcement.tone} title={t(announcement.title)}>
          <BlockStack gap="200">
            {announcement.content.map((paragraph: string, index: number) => (
              <Text key={index} variant="bodyMd" as="p">
                {t(paragraph)}
              </Text>
            ))}
          </BlockStack>
        </Banner>
      ))
    )
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(error, errorInfo)
  }
}
