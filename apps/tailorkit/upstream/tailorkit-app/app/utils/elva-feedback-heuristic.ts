/**
 * Elva KB — implicit feedback heuristic classifier.
 * Pure function, no dependencies. Classifies next user message after an Elva reply
 * as implicit downvote, upvote, or neutral based on phrase matching.
 *
 * Future upgrade: replace with text-embedding-3-small + k-NN against labeled examples.
 * Keep signature stable.
 */

const DOWNVOTE_PHRASES = [
  'no',
  "no it didn't",
  "didn't work",
  'did not work',
  'does not work',
  'still broken',
  'still not working',
  "still doesn't work",
  'that is wrong',
  "that's wrong",
  'incorrect',
  'not helpful',
  "doesn't work",
  'wrong answer',
  'not what i asked',
  'still failing',
  'no change',
  'same issue',
  'same problem',
  'nothing changed',
]

// Contextual guards — if the message contains any of these multi-word phrases,
// the standalone "no" should NOT fire as a downvote. Merchants often say
// "no problem" / "no worries" / "no rush" as polite acknowledgements.
const NO_GUARDS = ['no problem', 'no worries', 'no rush', 'no hurry', 'no need']

const UPVOTE_PHRASES = [
  'thanks',
  'thank you',
  'perfect',
  'that worked',
  'fixed',
  'solved',
  'great',
  'appreciate',
  'got it',
  'works now',
]

/**
 * Build a RegExp that matches a phrase as a whole-word boundary when the phrase
 * is a single word, or as a literal substring for multi-word phrases.
 * This prevents "no" matching inside "no problem", "know", etc.
 */
function buildMatcher(phrase: string): RegExp {
  const words = phrase.trim().split(/\s+/)
  if (words.length === 1) {
    // single word — use word boundaries
    return new RegExp(`\\b${escapeRegex(phrase)}\\b`, 'i')
  }
  // multi-word — require full phrase (spaces already act as natural delimiters)
  return new RegExp(escapeRegex(phrase), 'i')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Pre-compile matchers once at module load
const DOWNVOTE_MATCHERS = DOWNVOTE_PHRASES.map(p => ({ phrase: p, re: buildMatcher(p) }))
const UPVOTE_MATCHERS = UPVOTE_PHRASES.map(p => ({ phrase: p, re: buildMatcher(p) }))

export function classifyFeedback(nextMessage: string): {
  signal: 'implicit_down' | 'implicit_up' | 'neutral'
  triggerKeywords: string[]
} {
  if (!nextMessage) return { signal: 'neutral', triggerKeywords: [] }

  const lower = nextMessage.toLowerCase().trim()

  // If message contains a guard phrase, strip the standalone "no" hit to avoid FP.
  const hasNoGuard = NO_GUARDS.some(g => lower.includes(g))

  const downHitsRaw = DOWNVOTE_MATCHERS.filter(m => m.re.test(lower)).map(m => m.phrase)
  const downHits = hasNoGuard ? downHitsRaw.filter(p => p !== 'no') : downHitsRaw
  const upHits = UPVOTE_MATCHERS.filter(m => m.re.test(lower)).map(m => m.phrase)

  if (downHits.length && !upHits.length) return { signal: 'implicit_down', triggerKeywords: downHits }
  if (upHits.length && !downHits.length) return { signal: 'implicit_up', triggerKeywords: upHits }
  return { signal: 'neutral', triggerKeywords: [] }
}
