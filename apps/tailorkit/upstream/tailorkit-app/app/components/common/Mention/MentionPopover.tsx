import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, EmptySearchResult, InlineStack, Spinner, Text, TextField } from '@shopify/polaris'
import type { BaseMentionItem, MentionContext, MentionSource } from './types'
import { useTranslation } from 'react-i18next'

interface SectionState<T extends BaseMentionItem> {
  loading: boolean
  items: T[]
  error?: string
}

/**
 * Generic mention popover content that can render multiple sources.
 */
export function MentionPopover<T extends BaseMentionItem = BaseMentionItem>(props: {
  context: MentionContext | null
  sources: Array<MentionSource<T>>
  searchPlaceholder?: string
  onSelect: (item: T, sourceId: string, context: MentionContext) => void
}) {
  const { context, sources, onSelect, searchPlaceholder } = props
  const { t } = useTranslation()
  const [query, setQuery] = useState<string>('')
  const [sections, setSections] = useState<Record<string, SectionState<T>>>(() => {
    const initial: Record<string, SectionState<T>> = {}
    for (const s of sources) {
      initial[s.id] = {
        loading: Boolean(s.fetch),
        items: s.items ?? [],
      }
    }
    return initial
  })
  const abortControllersRef = useRef<Record<string, AbortController>>({})

  const effectiveQuery = query

  const performFetch = useCallback(
    async (source: MentionSource<T>, q: string) => {
      if (!source.fetch || !context) return
      const controller = new AbortController()
      abortControllersRef.current[source.id]?.abort()
      abortControllersRef.current[source.id] = controller
      setSections(prev => ({
        ...prev,
        [source.id]: { ...prev[source.id], loading: true, error: undefined },
      }))
      try {
        const res = await source.fetch(q, context)
        if (controller.signal.aborted) return
        setSections(prev => ({
          ...prev,
          [source.id]: { loading: false, items: res ?? [], error: undefined },
        }))
      } catch (e) {
        if (controller.signal.aborted) return
        setSections(prev => ({
          ...prev,
          [source.id]: {
            loading: false,
            items: prev[source.id]?.items ?? [],
            error: e instanceof Error ? e.message : 'Unknown error',
          },
        }))
      }
    },
    [context]
  )

  // Fetch per-source on mount and when query or context changes
  useEffect(() => {
    if (!context) return
    for (const s of sources) {
      const minChars = s.minChars ?? 0
      if (s.fetch) {
        if (effectiveQuery.length >= minChars) {
          void performFetch(s, effectiveQuery)
        } else {
          // If below minChars, clear items but not show error
          setSections(prev => ({
            ...prev,
            [s.id]: { ...prev[s.id], items: [], loading: false },
          }))
        }
      } else if (s.items) {
        // Static items: filter by label against query if provided
        const filtered = effectiveQuery
          ? s.items.filter(it => it.label.toLowerCase().includes(effectiveQuery.toLowerCase()))
          : s.items
        setSections(prev => ({ ...prev, [s.id]: { loading: false, items: filtered } }))
      }
    }
    return () => {
      // cancel outstanding requests
      for (const id of Object.keys(abortControllersRef.current)) {
        abortControllersRef.current[id]?.abort()
      }
      abortControllersRef.current = {}
    }
  }, [sources, effectiveQuery, performFetch, context])

  const handleSelect = useCallback(
    (sourceId: string, item: T) => {
      if (!context) return
      onSelect(item, sourceId, context)
    },
    [onSelect, context]
  )

  const hasAnyItems = useMemo(() => {
    return Object.values(sections).some(s => (s.items?.length ?? 0) > 0)
  }, [sections])

  return (
    <Box width="100%">
      {searchPlaceholder ? (
        <Box padding="200">
          <TextField
            label=""
            labelHidden
            placeholder={searchPlaceholder}
            value={query}
            onChange={setQuery}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setQuery('')}
          />
        </Box>
      ) : null}

      {sources.map(source => {
        const state = sections[source.id] ?? { loading: false, items: [] }
        const items = state.items ?? []
        return (
          <Box key={source.id} paddingBlockEnd="100" width="100%">
            {source.title ? (
              <Box paddingInline="200" paddingBlockEnd="100">
                <Text as="h3" variant="headingSm" tone="subdued">
                  {source.title}
                </Text>
              </Box>
            ) : null}

            {state.loading ? (
              <Box padding="400" width="100%">
                <InlineStack align="center" gap="200">
                  <Spinner size="small" />
                  <Text as="span" variant="bodySm">
                    {t('loading')}
                  </Text>
                </InlineStack>
              </Box>
            ) : items.length === 0 ? (
              <Box paddingInline="200" paddingBlockEnd="200">
                <EmptySearchResult title={source.emptyMessage ?? t('no-results')} withIllustration />
              </Box>
            ) : source.renderList ? (
              <>{source.renderList(items, { select: (it: T) => handleSelect(source.id, it), source })}</>
            ) : (
              <Box paddingInline="200">
                <div role="listbox" aria-label={source.title ?? source.id}>
                  {items.map(item => (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(source.id, item)}
                      style={{ cursor: 'pointer', padding: '8px 0' }}
                    >
                      {source.renderItem ? (
                        source.renderItem(item, { select: (it: T) => handleSelect(source.id, it) })
                      ) : (
                        <InlineStack gap="200" align="start" blockAlign="center">
                          {item.icon ? <div>{item.icon}</div> : null}
                          <Box>
                            <Text as="span" variant="bodyMd" fontWeight="medium">
                              {item.label}
                            </Text>
                            {item.description ? (
                              <Text as="p" variant="bodySm" tone="subdued">
                                {item.description}
                              </Text>
                            ) : null}
                          </Box>
                        </InlineStack>
                      )}
                    </div>
                  ))}
                </div>
              </Box>
            )}
          </Box>
        )
      })}

      {!hasAnyItems && sources.length === 0 ? (
        <Box padding="400" width="100%">
          <EmptySearchResult title={t('no-sources-configured')} />
        </Box>
      ) : null}
    </Box>
  )
}

export default MentionPopover
