import { Box, Layout, Text } from '@shopify/polaris'

interface SettingLayoutProps {
  title: string
  children: React.ReactNode
}

export default function SettingLayout({ title, children }: SettingLayoutProps) {
  return (
    <Layout>
      <Layout.Section variant="oneThird">
        <Box paddingInlineStart={{ xs: '200', md: '0' }}>
          <Text variant="bodyMd" fontWeight="semibold" as="p">
            {title}
          </Text>
        </Box>
      </Layout.Section>
      <Layout.Section>{children}</Layout.Section>
    </Layout>
  )
}
