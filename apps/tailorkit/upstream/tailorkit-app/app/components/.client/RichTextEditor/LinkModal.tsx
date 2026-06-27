import { Button, InlineGrid, Modal, Select, TextField } from '@shopify/polaris'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function LinkModal({
  state,
  onClose,
  onSave,
  onRemove,
}: {
  state: {
    open: boolean
    url: string
    target: '_self' | '_blank'
  }
  onClose: () => void
  onSave: (payload: { url: string; target: '_self' | '_blank' }) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const [url, setUrl] = useState(state.url || '')
  const [target, setTarget] = useState<'_self' | '_blank'>(state.target || '_self')

  useEffect(() => {
    setUrl(state.url || '')
    setTarget(state.target || '_self')
  }, [state.url, state.target, state.open])

  const targetOptions = useMemo(
    () => [
      { label: t('same-tab'), value: '_self' },
      { label: t('new-tab'), value: '_blank' },
    ],
    [t]
  )

  return (
    <Modal
      open={state.open}
      onClose={onClose}
      title={state.url ? t('edit-link') : t('insert-link')}
      primaryAction={{
        content: t('insert-link'),
        onAction: () => onSave({ url, target }),
        disabled: !url.trim(),
      }}
      secondaryActions={[
        {
          content: t('cancel'),
          onAction: onClose,
        },
      ]}
      footer={state.url && <Button onClick={onRemove}>{t('remove-link')}</Button>}
    >
      <Modal.Section>
        <InlineGrid gap="400" columns={2}>
          <TextField
            label={t('link-to')}
            value={url}
            onChange={setUrl}
            autoComplete="off"
            placeholder="https://"
            helpText={t('https-is-required-for-external-links')}
          />
          <Select
            label={t('open-this-link-in')}
            options={targetOptions}
            value={target}
            onChange={value => setTarget(value as any)}
          />
        </InlineGrid>
      </Modal.Section>
    </Modal>
  )
}
