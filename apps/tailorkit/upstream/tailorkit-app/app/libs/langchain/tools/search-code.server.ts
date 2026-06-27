/**
 * Code-informed RAG tool for Elva AI.
 * Searches pre-embedded code summaries in Supabase — returns merchant-friendly
 * descriptions, NEVER raw source code.
 */

import supabaseClient from '~/utils/supabase-client.server'
import { generateEmbedding } from '~/utils/openai-client.server'

interface CodeSearchResult {
  id: string
  file_path: string
  chunk_id: string
  summary: string
  similarity: number
}

/**
 * Search code knowledge base for internal context.
 * Returns structured summaries that the agentic loop translates into merchant-friendly answers.
 */
export async function searchCode(query: string, shopDomain?: string): Promise<string> {
  try {
    const embedding = await generateEmbedding(query, shopDomain)

    const { data: results, error } = await supabaseClient.rpc('match_code_documents', {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: 5,
    })

    if (error) {
      console.error('[search-code] Supabase RPC error:', error)
      return 'No internal context found for this query.'
    }

    if (!results || results.length === 0) {
      return 'No internal context found for this query.'
    }

    const summaries = results
      .map((r: CodeSearchResult, i: number) => `[${i + 1}] ${r.file_path} — ${r.summary}`)
      .join('\n\n')

    return [
      'Internal context (DO NOT share raw implementation details with the merchant):',
      '',
      summaries,
      '',
      'Use these notes to give an accurate, merchant-friendly answer.',
    ].join('\n')
  } catch (error: unknown) {
    console.error('[search-code] Error:', error instanceof Error ? error.message : 'Unknown error')
    return 'Code search unavailable. Answer based on documentation knowledge.'
  }
}
