/**
 * Category name for font combinations cliparts in the RAG database.
 * Used to filter vector search results to only font combination templates.
 */
export const FONT_COMBINATIONS_CATEGORY = 'Font combinations'

/**
 * Default options for RAG (Retrieval-Augmented Generation) vector search.
 *
 * - `match_threshold`: Minimum similarity score (0-1) to include a result.
 *   Set to 0.15 (15%) to cast a wide net and let dynamic filtering handle quality.
 *   Lower values = more results but potentially less relevant.
 *
 * - `match_count`: Maximum number of results to retrieve from vector database.
 *   Set to 15 to have enough candidates for dynamic filtering.
 *   Higher values = more options but slower query.
 */
export const DEFAULT_MATCH_OPTIONS = {
  match_threshold: 0.15,
  match_count: 15,
}

/**
 * Dynamic filtering options to select high-quality candidates from RAG results.
 *
 * These thresholds determine confidence levels and filter candidates based on
 * similarity scores relative to the top result.
 *
 * - `high_confidence_threshold`: 0.45 (45%)
 *   If top result score ≥ 45%, we have HIGH confidence in semantic matching.
 *   Example: Score 50% means the query strongly matches the font combination.
 *
 * - `low_confidence_threshold`: 0.24 (24%)
 *   If top result score ≥ 24% but < 45%, we have LOW confidence.
 *   Results are still relevant but less precise - use "best effort" mode.
 *
 * - `relative_threshold_ratio`: 0.65 (65%)
 *   In HIGH confidence mode, accept candidates scoring ≥ (topScore × 0.65).
 *   Example: If top = 50%, accept candidates ≥ 32.5% (50% × 0.65).
 *
 *   Why 0.65?
 *   - Semantic embeddings naturally have score variance (30-50% is common for good matches)
 *   - We want diversity in font suggestions, not just near-identical matches
 *   - Too high (e.g., 0.85) filters out relevant options with slight score differences
 *   - Too low (e.g., 0.45) may include unrelated results
 *   - 0.65 balances quality and variety for creative font selections
 *
 * - `best_effort_count`: 6
 *   In LOW confidence mode, take top 6 results regardless of relative scores.
 *   Provides suggestions even when semantic matching isn't strong.
 */
export const DYNAMIC_FILTER_OPTIONS = {
  high_confidence_threshold: 0.45,
  low_confidence_threshold: 0.24,
  relative_threshold_ratio: 0.65,
  best_effort_count: 6,
}

/**
 * Final number of font combination suggestions to return to the user.
 * Set to 6 to provide enough variety without overwhelming choice.
 */
export const FINAL_SUGGESTIONS_COUNT = 6
