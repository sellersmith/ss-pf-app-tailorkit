import { Banner, List } from '@shopify/polaris'
import { Fragment } from 'react'

interface ErrorFilesMessageProps {
  rejectedFiles: { error: string }[]
}

function ErrorFilesMessage(props: ErrorFilesMessageProps) {
  const { rejectedFiles } = props

  return (
    <Fragment>
      <Banner title="The following images couldn’t be uploaded:" tone="critical">
        <List type="bullet">
          {rejectedFiles.map((file, index) => (
            <List.Item key={index}>{`${file.error}`}</List.Item>
          ))}
        </List>
      </Banner>
    </Fragment>
  )
}

export function ErrorUploadFilesMessage(props: { message: string }) {
  const { message } = props

  return <Banner title={message} tone="critical"></Banner>
}

export default ErrorFilesMessage
