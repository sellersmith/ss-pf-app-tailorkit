/**
 * Elva KB — shared Supabase RPC helpers usable from both server code and CLI scripts.
 *
 * Avoids pulling the full `.server.ts` module into scripts (which would drag Remix deps).
 * Reads env vars lazily so scripts can set them before first call.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type DocumentationRow = {
  id: string
  title: string
  content: string
  category: string
  similarity?: number
  ai_metadata?: KbAiMetadata | null
  created_at?: string
  updated_at?: string
}

export type KbAiMetadata = {
  source: 'ai' | 'human'
  related_commits?: string[]
  source_files?: string[]
  confidence?: 'High' | 'Med' | 'Low'
  needs_review?: boolean
  last_reviewed_date?: string
  superseded_by?: string | null
  generator?: string
}

let cachedClient: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var')
  }
  cachedClient = createClient(url, key)
  return cachedClient
}

/**
 * Semantic search against the `documentation` table.
 * Thin wrapper on `match_documents` RPC already used by Elva's reply path.
 */
export async function searchDocumentation(
  embedding: number[],
  opts: { matchThreshold?: number; matchCount?: number } = {}
): Promise<{ documents: DocumentationRow[]; error: unknown }> {
  const client = getSupabaseClient()
  const { data, error } = await client.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: opts.matchThreshold ?? 0.5,
    match_count: opts.matchCount ?? 5,
  })
  return { documents: (data as DocumentationRow[]) || [], error }
}

/**
 * Fetch a documentation row by id (for UPDATE flow or rollback preview).
 */
export async function fetchDocumentationById(id: string) {
  const client = getSupabaseClient()
  const { data, error } = await client.from('documentation').select('*').eq('id', id).maybeSingle()
  return { row: data as DocumentationRow | null, error }
}

// Supabase error code when a column referenced in a write does not exist.
const MISSING_COLUMN_CODE = 'PGRST204'

function isMissingAiMetadataError(error: any): boolean {
  return error?.code === MISSING_COLUMN_CODE && /ai_metadata/.test(error?.message || '')
}

/**
 * Insert a new documentation row with AI metadata.
 * Falls back to a write without ai_metadata if the column is absent
 * (migration 001 not yet applied). A warning is logged so operators
 * know the AI metadata was dropped for this write.
 */
export async function insertDocumentation(payload: {
  title: string
  content: string
  category: string
  embedding: number[]
  aiMetadata: KbAiMetadata
}) {
  const client = getSupabaseClient()
  const basePayload = {
    title: payload.title,
    content: payload.content,
    category: payload.category,
    embedding: payload.embedding,
  }
  let attempt = await client
    .from('documentation')
    .insert({ ...basePayload, ai_metadata: payload.aiMetadata })
    .select()
    .single()

  if (attempt.error && isMissingAiMetadataError(attempt.error)) {
    // eslint-disable-next-line no-console
    console.warn('[elva-kb-rpc] ai_metadata column missing (run migration 001) — retrying insert without metadata')
    attempt = await client.from('documentation').insert(basePayload).select().single()
  }

  return { row: attempt.data as DocumentationRow | null, error: attempt.error }
}

/**
 * Update an existing documentation row. Also refreshes embedding + metadata.
 */
export async function updateDocumentation(
  id: string,
  payload: {
    title?: string
    content?: string
    category?: string
    embedding?: number[]
    aiMetadata?: KbAiMetadata
  }
) {
  const client = getSupabaseClient()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (payload.title !== undefined) update.title = payload.title
  if (payload.content !== undefined) update.content = payload.content
  if (payload.category !== undefined) update.category = payload.category
  if (payload.embedding !== undefined) update.embedding = payload.embedding
  if (payload.aiMetadata !== undefined) update.ai_metadata = payload.aiMetadata

  let attempt = await client.from('documentation').update(update).eq('id', id).select().single()
  if (attempt.error && isMissingAiMetadataError(attempt.error) && 'ai_metadata' in update) {
    // eslint-disable-next-line no-console
    console.warn('[elva-kb-rpc] ai_metadata column missing (run migration 001) — retrying update without metadata')
    const { ai_metadata: _drop, ...rest } = update
    attempt = await client.from('documentation').update(rest).eq('id', id).select().single()
  }

  return { row: attempt.data as DocumentationRow | null, error: attempt.error }
}

/**
 * Delete a documentation row (hard delete). Used by rollback with --confirm.
 */
export async function deleteDocumentation(id: string) {
  const client = getSupabaseClient()
  const { error } = await client.from('documentation').delete().eq('id', id)
  return { error }
}

/**
 * Stream all documentation rows (for audit scan). Paginated to avoid memory spikes.
 *
 * Tries to select `ai_metadata` first; if the column is missing (migration 001
 * not yet applied), falls back to the minimal column set so audit still runs.
 */
export async function* iterateDocumentation(batchSize = 200): AsyncGenerator<DocumentationRow[]> {
  const client = getSupabaseClient()
  const fullCols = 'id,title,content,category,ai_metadata,created_at,updated_at'
  const minimalCols = 'id,title,content,category,created_at,updated_at'
  let selectCols = fullCols
  let from = 0

  while (true) {
    let { data, error } = await client
      .from('documentation')
      .select(selectCols)
      .order('created_at', { ascending: true })
      .range(from, from + batchSize - 1)

    if (error && (error as any).code === '42703' && /ai_metadata/.test((error as any).message || '')) {
      // eslint-disable-next-line no-console
      console.warn('[elva-kb-rpc] ai_metadata column missing — audit will run without AI metadata fields')
      selectCols = minimalCols
      const retry = await client
        .from('documentation')
        .select(selectCols)
        .order('created_at', { ascending: true })
        .range(from, from + batchSize - 1)
      data = retry.data
      error = retry.error
    }

    if (error) throw error
    const batch = (data as unknown as DocumentationRow[]) || []
    if (batch.length === 0) break
    yield batch
    if (batch.length < batchSize) break
    from += batchSize
  }
}
