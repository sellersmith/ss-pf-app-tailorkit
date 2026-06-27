import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BlockStack, Button, InlineStack, Text, Popover, ActionList, Spinner } from '@shopify/polaris'
import { t } from 'i18next'
import { useFeatureTracking } from '~/hooks/useFeatureTracking'
import { fontLoader } from './instances'
import { useQueryFonts } from '../../hooks/useQueryFonts'
import { useUploadFiles } from '../../../hooks/useUploadFiles'
import { processFileUpload, validateFiles } from '../../../modals/FontUploaderModal/fns'
import { ALLOWED_FONT_EXTENSIONS } from '~/constants/dropzone'

interface EmojiFontPickerProps {
  font?: { family: string; src: string }
  emojis: string
  onChange: (font: { family: string; src: string } | undefined) => void
  onEmojisChange: (emojis: string) => void
  /** Show font upload button (edge case feature for merchants with custom fonts) */
  allowFontUpload?: boolean
}

interface FontItem {
  _id?: string
  nameWithoutExtension?: string
  name?: string
  url: string
  svgString?: string
}

const PUA_START = 0xe000
const PUA_END = 0xf8ff
const GLYPH_WIDTH_THRESHOLD = 0.5
const FONT_LOAD_DELAY_MS = 100

/** Cache to avoid re-scanning the same font family */
const glyphCache = new Map<string, string[]>()

/**
 * Detect which code points have actual glyphs in a loaded font
 * by comparing canvas measurements against a known-missing fallback.
 * Scans Private Use Area (U+E000–U+F8FF) where custom icon fonts typically map glyphs.
 */
function detectFontGlyphs(fontFamily: string): string[] {
  if (glyphCache.has(fontFamily)) {
    return glyphCache.get(fontFamily)!
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  const size = 48
  canvas.width = size
  canvas.height = size

  const glyphs: string[] = []

  // Measure a known missing character to get the "tofu" width
  ctx.font = `${size}px '${fontFamily}'`
  const missingWidth = ctx.measureText('\uFFFF').width

  // Scan PUA range — where custom emoji/icon fonts map their glyphs
  for (let cp = PUA_START; cp <= PUA_END; cp++) {
    const char = String.fromCodePoint(cp)
    const charWidth = ctx.measureText(char).width
    // If width differs from missing glyph, this code point has a real glyph
    if (charWidth > 0 && Math.abs(charWidth - missingWidth) > GLYPH_WIDTH_THRESHOLD) {
      glyphs.push(char)
    }
  }

  glyphCache.set(fontFamily, glyphs)
  return glyphs
}

/**
 * Font selector + glyph picker for the emoji picker.
 * After selecting a custom font, shows a grid of available glyphs
 * that merchants can click to add to the "Allowed emojis" field.
 */
export function EmojiFontPicker({
  font,
  emojis,
  onChange,
  onEmojisChange,
  allowFontUpload = false,
}: EmojiFontPickerProps) {
  const [popoverActive, setPopoverActive] = useState(false)
  const [glyphs, setGlyphs] = useState<string[]>([])
  const [detectingGlyphs, setDetectingGlyphs] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [hasUploaded, setHasUploaded] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { fonts, loading, fetchFonts } = useQueryFonts('')
  const { uploadFiles } = useUploadFiles()
  const styleRef = useRef<HTMLStyleElement | null>(null)
  const tracking = useFeatureTracking('custom_emoji_font')
  const hasTrackedRef = useRef(false)

  // Load the selected font and detect its glyphs
  useEffect(() => {
    if (!font?.family || !font?.src) {
      setGlyphs([])
      return
    }

    setDetectingGlyphs(true)
    fontLoader
      .loadFont(font.family, font.src)
      .then(() => {
        // Small delay to ensure font is fully registered in the browser
        setTimeout(() => {
          const detected = detectFontGlyphs(font.family)
          setGlyphs(detected)
          setDetectingGlyphs(false)
        }, FONT_LOAD_DELAY_MS)
      })
      .catch((err: unknown) => {
        console.error('[EmojiFontPicker] Failed to load font:', err)
        setDetectingGlyphs(false)
      })
  }, [font?.family, font?.src])

  // Inject CSS to override Polaris font-family on the "Allowed emojis" input.
  // Uses a CSS custom property to avoid CSS injection via string interpolation.
  useEffect(() => {
    if (font?.family) {
      document.documentElement.style.setProperty('--emoji-font-family', `'${CSS.escape(font.family)}'`)

      if (!styleRef.current) {
        styleRef.current = document.createElement('style')
        styleRef.current.id = 'emoji-font-override'
        styleRef.current.textContent = `
          .emoji-font-input .Polaris-TextField__Input {
            font-family: var(--emoji-font-family), sans-serif !important;
            font-size: 20px !important;
          }
        `
        document.head.appendChild(styleRef.current)
      }
    } else {
      document.documentElement.style.removeProperty('--emoji-font-family')
      if (styleRef.current) {
        styleRef.current.remove()
        styleRef.current = null
      }
    }

    return () => {
      document.documentElement.style.removeProperty('--emoji-font-family')
      if (styleRef.current) {
        styleRef.current.remove()
        styleRef.current = null
      }
    }
  }, [font?.family])

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length === 0) return

      // Reset input so same file can be re-selected if needed
      e.target.value = ''

      const invalidFiles = validateFiles(files)
      if (invalidFiles.length === files.length) {
        setUploadError(t('invalid-font-files'))
        return
      }

      const validFiles = files.filter(f => !invalidFiles.some((inv: { name: string }) => inv.name === f.name))

      setUploading(true)
      setUploadError(null)

      try {
        const result = await processFileUpload(
          validFiles,
          uploadFiles,
          () => {},
          (message: string) => setUploadError(message)
        )

        if (result.success && result.uploadedFiles.length > 0) {
          // Refresh font list, auto-select uploaded font, and open dropdown
          await fetchFonts(1, false)
          const uploaded = result.uploadedFiles[0]
          const family = uploaded.nameWithoutExtension || uploaded.name || ''
          const src = uploaded.url || ''
          if (family && src) {
            onChange({ family, src })
          }
          setHasUploaded(true)
          setPopoverActive(true)
          if (!hasTrackedRef.current) {
            tracking.trackStarted()
            hasTrackedRef.current = true
          }
          tracking.trackAction('font_uploaded')
        }
      } catch (err: unknown) {
        console.error('[EmojiFontPicker] Upload failed:', err)
        setUploadError(t('failed-to-upload-font'))
      } finally {
        setUploading(false)
      }
    },
    [uploadFiles, fetchFonts, onChange, tracking]
  )

  const handleRemove = useCallback(() => {
    onChange(undefined)
    onEmojisChange('')
  }, [onChange, onEmojisChange])

  const handleGlyphClick = useCallback(
    (glyph: string) => {
      // Toggle: if already in emojis, remove it; otherwise add it
      if (emojis.includes(glyph)) {
        onEmojisChange(emojis.replace(glyph, ''))
      } else {
        onEmojisChange(emojis + glyph)
      }
    },
    [emojis, onEmojisChange]
  )

  const actionItems = useMemo(
    () =>
      (fonts as FontItem[]).map(item => ({
        content: item.nameWithoutExtension || item.name,
        onAction: () => {
          const family = item.nameWithoutExtension || item.name || ''
          onChange({ family, src: item.url })
          setPopoverActive(false)
          if (!hasTrackedRef.current) {
            tracking.trackStarted()
            hasTrackedRef.current = true
          }
        },
      })),
    [fonts, onChange, tracking]
  )

  const activator = (
    <Button onClick={() => setPopoverActive(prev => !prev)} disclosure={popoverActive ? 'up' : 'down'} size="slim">
      {font?.family || t('select-font')}
    </Button>
  )

  return (
    <BlockStack gap="200">
      <InlineStack gap="200" blockAlign="center">
        {allowFontUpload ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_FONT_EXTENSIONS.join(',')}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <Button onClick={handleUploadClick} size="slim" loading={uploading} disabled={uploading}>
              {t('upload-font')}
            </Button>
            {/* Dropdown only appears after merchant uploads a font from this button */}
            {hasUploaded && fonts.length > 0 && (
              <Popover
                active={popoverActive}
                activator={activator}
                onClose={() => setPopoverActive(false)}
                preferredAlignment="left"
              >
                <div style={{ maxHeight: '240px', overflow: 'auto', minWidth: '220px' }}>
                  <ActionList items={actionItems} />
                </div>
              </Popover>
            )}
          </>
        ) : (
          <Popover
            active={popoverActive}
            activator={activator}
            onClose={() => setPopoverActive(false)}
            preferredAlignment="left"
          >
            <div
              style={{ maxHeight: '240px', overflow: 'auto', minWidth: '220px', padding: loading ? '12px' : undefined }}
            >
              {loading && fonts.length === 0 ? (
                <InlineStack align="center">
                  <Spinner size="small" />
                </InlineStack>
              ) : fonts.length === 0 ? (
                <div style={{ padding: '12px' }}>
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {t('no-custom-fonts-uploaded')}
                  </Text>
                </div>
              ) : (
                <ActionList items={actionItems} />
              )}
            </div>
          </Popover>
        )}

        {font && (
          <Button onClick={handleRemove} variant="plain" tone="critical" size="slim">
            {t('remove')}
          </Button>
        )}
      </InlineStack>

      {uploadError && (
        <Text as="span" variant="bodySm" tone="critical">
          {uploadError}
        </Text>
      )}

      {/* Glyph picker grid — shown after font is selected */}
      {font && (
        <BlockStack gap="100">
          <Text as="span" variant="bodySm" tone="subdued">
            {t('click-to-toggle-emojis-count-available', { count: glyphs.length })}
          </Text>
          {detectingGlyphs ? (
            <InlineStack align="center">
              <Spinner size="small" />
            </InlineStack>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                maxHeight: '200px',
                overflow: 'auto',
                padding: '4px',
                border: '1px solid var(--p-color-border)',
                borderRadius: '8px',
              }}
            >
              {glyphs.map((glyph, i) => {
                const isSelected = emojis.includes(glyph)
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleGlyphClick(glyph)}
                    title={`U+${glyph.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')}`}
                    style={{
                      fontFamily: `'${font.family}'`,
                      fontSize: '24px',
                      width: '36px',
                      height: '36px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: isSelected ? '2px solid var(--p-color-border-interactive)' : '1px solid transparent',
                      borderRadius: '6px',
                      background: isSelected
                        ? 'var(--p-color-bg-surface-secondary-active)'
                        : 'var(--p-color-bg-surface-secondary)',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {glyph}
                  </button>
                )
              })}
              {glyphs.length === 0 && (
                <Text as="span" variant="bodySm" tone="subdued">
                  {t('no-glyphs-detected-in-this-font')}
                </Text>
              )}
            </div>
          )}
        </BlockStack>
      )}
    </BlockStack>
  )
}
