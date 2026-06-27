import { InlineStack, TextField, Select } from '@shopify/polaris'

interface EmailFilterProps {
  emailPattern: string
  filterMode: 'include' | 'exclude'
  onEmailPatternChange: (value: string) => void
  onFilterModeChange: (value: 'include' | 'exclude') => void
}

export function EmailFilter({ emailPattern, filterMode, onEmailPatternChange, onFilterModeChange }: EmailFilterProps) {
  return (
    <InlineStack gap="200" blockAlign="start">
      <TextField
        label="Filter by Shop Email"
        value={emailPattern}
        onChange={onEmailPatternChange}
        placeholder="e.g., @bravebits.vn"
        helpText="Filter stores by email pattern"
        autoComplete="off"
      />
      <Select
        label="Filter Mode"
        options={[
          { label: 'Exclude', value: 'exclude' },
          { label: 'Include Only', value: 'include' },
        ]}
        value={filterMode}
        onChange={onFilterModeChange}
      />
    </InlineStack>
  )
}
