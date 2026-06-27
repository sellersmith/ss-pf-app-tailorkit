/**
 * Code embedding utilities for the search_code tool.
 * Chunks TypeScript/Liquid files by export boundaries and generates
 * merchant-friendly summaries (never raw code).
 */

import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

/** Glob patterns for merchant-facing code to index */
export const INCLUDE_PATTERNS = [
  'app/routes/**/route.ts',
  'app/routes/**/route.tsx',
  'app/routes/**/fns.server.ts',
  'extensions/tailorkit-src/src/snippets/**/*.liquid',
  'extensions/tailorkit-src/src/assets/components/**/*.ts',
  'app/routes/api.integration/preparation-fns.server.ts',
]

/** Glob patterns and content patterns to exclude */
export const EXCLUDE_PATTERNS = ['**/*.test.*', '**/*.d.ts', '**/node_modules/**', '**/__tests__/**']

/** Content patterns that indicate sensitive files — skip entirely */
export const SENSITIVE_CONTENT_PATTERNS = [/API_KEY/i, /SECRET/i, /PASSWORD/i, /CREDENTIALS/i, /\.env/, /MONGODB_URI/i]

export interface CodeChunk {
  name: string
  content: string
  startLine: number
  endLine: number
}

/**
 * Chunk a TypeScript file by export boundaries.
 * Falls back to fixed-size chunks (80 lines, 10 overlap) for non-TS files.
 */
export function chunkFileByExports(source: string, filePath: string): CodeChunk[] {
  const lines = source.split('\n')
  const isLiquid = filePath.endsWith('.liquid')

  if (isLiquid) return chunkByFixedSize(lines, filePath)

  const chunks: CodeChunk[] = []
  const exportRegex = /^export\s+(async\s+)?(function|const|class|type|interface|enum)\s+(\w+)/

  let currentChunk: { name: string; startLine: number; lines: string[] } | null = null

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(exportRegex)

    if (match) {
      if (currentChunk) {
        chunks.push({
          name: currentChunk.name,
          content: currentChunk.lines.join('\n'),
          startLine: currentChunk.startLine,
          endLine: i - 1,
        })
      }
      currentChunk = { name: match[3], startLine: i, lines: [lines[i]] }
    } else if (currentChunk) {
      currentChunk.lines.push(lines[i])
    }
  }

  // Push last chunk
  if (currentChunk) {
    chunks.push({
      name: currentChunk.name,
      content: currentChunk.lines.join('\n'),
      startLine: currentChunk.startLine,
      endLine: lines.length - 1,
    })
  }

  // If no exports found, fall back to fixed-size
  return chunks.length > 0 ? chunks : chunkByFixedSize(lines, filePath)
}

/** Fixed-size chunking with overlap for files without clear boundaries */
function chunkByFixedSize(lines: string[], filePath: string): CodeChunk[] {
  const CHUNK_SIZE = 80
  const OVERLAP = 10
  const chunks: CodeChunk[] = []
  const baseName = filePath.split('/').pop() || 'chunk'

  for (let i = 0; i < lines.length; i += CHUNK_SIZE - OVERLAP) {
    const end = Math.min(i + CHUNK_SIZE, lines.length)
    chunks.push({
      name: `${baseName}:${i + 1}-${end}`,
      content: lines.slice(i, end).join('\n'),
      startLine: i,
      endLine: end - 1,
    })
    if (end >= lines.length) break
  }

  return chunks
}

/** Check if file content contains sensitive patterns */
export function containsSensitiveContent(content: string): boolean {
  return SENSITIVE_CONTENT_PATTERNS.some(pattern => pattern.test(content))
}

/**
 * Generate a merchant-friendly summary for a code chunk using GPT-4o-mini.
 * Returns a 1-3 sentence description — no raw code.
 */
export async function generateChunkSummary(chunkContent: string, filePath: string, chunkName: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            "Describe what this code does from a merchant's perspective. "
            + 'Focus on: what feature it enables, what inputs/outputs it handles, '
            + 'what Shopify concepts it relates to. Do NOT include code. Max 3 sentences.',
        },
        {
          role: 'user',
          content: `File: ${filePath}\nFunction/Section: ${chunkName}\n\n${chunkContent.slice(0, 3000)}`,
        },
      ],
      max_tokens: 150,
      temperature: 0.1,
    })

    return response.choices[0]?.message?.content || `Feature from ${filePath}: ${chunkName}`
  } catch (error: any) {
    console.error(`[code-embedder] Summary generation failed for ${filePath}:${chunkName}:`, error.message)
    return `Feature from ${filePath}: ${chunkName}`
  }
}
