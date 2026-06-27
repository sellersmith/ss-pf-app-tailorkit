import { BlockStack, Button, Card, InlineStack, Modal, Text } from '@shopify/polaris'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SettingLayout from '~/routes/settings/components/SettingLayout'
import { EmojiFontPicker } from '~/modules/TemplateEditor/elements/components/Text/EmojiFontPicker'
import { authenticatedFetch } from '~/shopify/fns.client'
import { showToast } from '~/utils/toastEvents'

interface EmojiPickerValue {
  emojis?: string
  font?: { family: string; src: string }
}

interface EmojiPickerCardProps {
  isSaving: boolean
  value: EmojiPickerValue
  onChange: (value: EmojiPickerValue) => void
}

/**
 * Storefront Setup card for the GLOBAL Allowed Emojis master list.
 *
 * The merchant configures the canonical emoji set (font + glyph selection)
 * here, then clicks "Apply to all templates" to replace the emoji list on
 * every text layer in the shop that already has the emoji picker enabled.
 * This is a one-shot bulk operation: per-template tweaks are still done in
 * the template editor's text layer settings, not here.
 *
 * Different from Colour Guide (which is a live default at publish time):
 * this is an admin bulk-edit, no live link to the storefront.
 */
export default function EmojiPickerCard({ isSaving, value, onChange }: EmojiPickerCardProps) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [applying, setApplying] = useState(false)

  // Split the emoji string into graphemes for the preview row. Intl.Segmenter
  // is the only correct way to do this — `Array.from` would shatter ZWJ
  // sequences (🏳️‍🌈, 👩‍👩‍👧‍👦), skin-tone modifiers (👋🏽), and combining marks
  // into multiple chips. Available in Node 16+ and every current browser.
  // Memoised because a full PUA-range font scan can return thousands of
  // glyphs, and this card re-renders on every save-bar / font-load tick.
  const selectedGlyphs = useMemo(
    () =>
      value.emojis
        ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value.emojis)].map(s => s.segment)
        : [],
    [value.emojis]
  )

  const handleFontChange = useCallback(
    (font: { family: string; src: string } | undefined) => {
      // Clearing the font also clears the emoji selection — the glyphs only
      // make sense in the context of the font that defines them.
      if (!font) {
        onChange({ ...value, font: undefined, emojis: '' })
        return
      }
      onChange({ ...value, font })
    },
    [onChange, value]
  )

  const handleEmojisChange = useCallback(
    (emojis: string) => {
      onChange({ ...value, emojis })
    },
    [onChange, value]
  )

  const handleApply = useCallback(async () => {
    setApplying(true)
    try {
      const res = await authenticatedFetch('/api/emoji-picker/apply-to-all', {
        method: 'POST',
        body: JSON.stringify({
          emojis: value.emojis || '',
          font: value.font,
        }),
      })
      if (!res?.success) {
        throw new Error(res?.error || 'Apply failed')
      }
      const modified = res.modified ?? 0
      showToast(t('applied-emojis-to-text-layers', { count: modified }) || `Applied to ${modified} text layers`)
      setConfirmOpen(false)
    } catch (err) {
      console.error('[EmojiPickerCard] apply failed', err)
      showToast(t('apply-emojis-failed') || 'Apply failed', { isError: true })
    } finally {
      setApplying(false)
    }
  }, [t, value.emojis, value.font])

  const hasSelection = Boolean(value.emojis && value.emojis.length > 0)
  // Apply is disabled while the merchant has unsaved changes — we only want
  // to bulk-write the version that's actually persisted in appMetafields, so
  // the "Save" save-bar flow must run first.
  const applyDisabled = !hasSelection || isSaving

  return (
    <SettingLayout title={t('global-emoji-picker')}>
      <Card>
        <BlockStack gap="400">
          <Text as="p" variant="bodyMd" tone="subdued">
            {t('global-emoji-picker-description')}
          </Text>

          <EmojiFontPicker
            font={value.font}
            emojis={value.emojis || ''}
            onChange={handleFontChange}
            onEmojisChange={handleEmojisChange}
            allowFontUpload
          />

          {selectedGlyphs.length > 0 && (
            <BlockStack gap="100">
              <Text as="span" variant="bodySm" tone="subdued">
                {t('selected-emojis-count', { count: selectedGlyphs.length })}
              </Text>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                  padding: '8px',
                  border: '1px solid var(--p-color-border)',
                  borderRadius: '8px',
                  background: 'var(--p-color-bg-surface-secondary)',
                }}
              >
                {selectedGlyphs.map((glyph, i) => (
                  <span
                    key={`${glyph}-${i}`}
                    title={`U+${glyph.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`}
                    style={{
                      fontFamily: value.font?.family ? `'${value.font.family.replace(/'/g, "\\'")}'` : undefined,
                      fontSize: '24px',
                      width: '36px',
                      height: '36px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--p-color-bg-surface)',
                      borderRadius: '6px',
                    }}
                  >
                    {glyph}
                  </span>
                ))}
              </div>
            </BlockStack>
          )}

          <InlineStack gap="200" align="end">
            <Button onClick={() => setConfirmOpen(true)} disabled={applyDisabled} variant="primary">
              {t('apply-to-all-templates')}
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => (applying ? undefined : setConfirmOpen(false))}
        title={t('apply-emojis-confirm-title')}
        primaryAction={{
          content: t('apply'),
          onAction: handleApply,
          loading: applying,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: t('cancel'),
            onAction: () => setConfirmOpen(false),
            disabled: applying,
          },
        ]}
      >
        <Modal.Section>
          <Text as="p" variant="bodyMd">
            {t('apply-emojis-confirm-body')}
          </Text>
        </Modal.Section>
      </Modal>
    </SettingLayout>
  )
}
