import { BlockStack, List, Text } from '@shopify/polaris'

export const ListChangeLog = ({ title, list }: { title: string; list: { value: string; note?: string }[] }) => (
  <BlockStack gap="200">
    <Text variant="bodyLg" as="p" fontWeight="medium">
      {title}
    </Text>
    <List gap="loose">
      {list.map((item, index) => (
        <List.Item key={index}>{item.value}</List.Item>
      ))}
    </List>
  </BlockStack>
)
