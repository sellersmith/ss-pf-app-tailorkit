/**
 * Skill executor — validates input, loads handler JIT, executes, returns SkillResult.
 * Runs before the multi-agent supervisor — if request has a skill field,
 * this executor handles it directly without intent routing.
 */

import { getSkillByCommand, listSkills } from './registry'
import type { SkillContext, SkillResult, SkillStatusCallback } from './types'

const SKILL_TIMEOUT_MS = 30_000

/** Execute a skill by command name with input, context, and optional status callback */
export async function executeSkill(
  command: string,
  input: string,
  context: SkillContext,
  onStatus?: SkillStatusCallback
): Promise<SkillResult> {
  const entry = getSkillByCommand(command)

  if (!entry) {
    return {
      success: false,
      error: `Unknown skill: /${command}. Available skills: ${listSkills()
        .filter(s => s.status === 'active')
        .map(s => s.command)
        .join(', ')}`,
    }
  }

  // Reject coming_soon skills with friendly message
  if (entry.status === 'coming_soon') {
    return {
      success: false,
      error: `/${command} is coming soon! This skill is under development.`,
    }
  }

  // Validate input against schema if defined
  if (entry.inputSchema) {
    const parseResult = entry.inputSchema.safeParse(input)
    if (!parseResult.success) {
      return {
        success: false,
        error: `Invalid input for /${command}: ${parseResult.error.message}`,
      }
    }
  }

  // Load handler JIT (dynamic import)
  let handler
  try {
    const module = await entry.handler()
    handler = module.default
  } catch {
    return {
      success: false,
      error: `Skill /${command} is not available yet. It will be implemented soon.`,
    }
  }

  if (typeof handler !== 'function') {
    return {
      success: false,
      error: `Skill /${command} handler is misconfigured.`,
    }
  }

  // Execute with timeout, passing onStatus callback to handler
  try {
    const result = await Promise.race([
      handler(input, context, onStatus),
      new Promise<SkillResult>((_, reject) =>
        setTimeout(() => reject(new Error('Skill execution timed out')), SKILL_TIMEOUT_MS)
      ),
    ])
    return result
  } catch (err: any) {
    return {
      success: false,
      error: `Skill /${command} failed: ${err.message || 'Unknown error'}`,
    }
  }
}
