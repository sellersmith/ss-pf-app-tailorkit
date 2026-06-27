import { capitalizeFirstLetter } from '../../../assets/fns/capitalize-first-letter'
/**
 * Shared utilities for AI effect prompt handling.
 * Used by both admin (useAIImageGenerator) and storefront (GenerateImagePopover).
 */

export interface SelectedEffect {
  name: string
  instruction: string
}

/**
 * Extracts variable names from an instruction string.
 * Variables are in the format {{variable_name}}.
 *
 * @example
 * extractVariables("Hello {{name}}, your order is {{order_id}}")
 * // Returns: ["name", "order_id"]
 */
export function extractVariables(instruction: string): string[] {
  const matches = instruction.match(/\{\{([^}]+)\}\}/g)
  if (!matches) return []

  const variableNames = matches.map(match => match.replace(/\{\{|\}\}/g, ''))
  return [...new Set(variableNames)]
}

/**
 * Creates placeholder text for variable inputs.
 * Converts variable names like "family_name" to "Family name: ..."
 *
 * @example
 * createVariablePlaceholder("Generate image of {{family_name}} on {{date}}")
 * // Returns: "Family name: ...\nDate: ..."
 */
export function createVariablePlaceholder(instruction: string): string {
  const variables = extractVariables(instruction)
  if (variables.length === 0) return ''

  return variables.map(v => `${capitalizeFirstLetter(v.replace(/_/g, ' '))}: ...`).join('\n')
}

/**
 * Checks if an instruction contains variables.
 */
export function hasVariables(instruction: string): boolean {
  return instruction.includes('{{')
}

/**
 * Computes the final prompt by combining the selected effect instruction with user input.
 *
 * If the instruction has variables ({{variable}}):
 * - Parses user input lines like "Variable name: value"
 * - Replaces variables in the instruction with the provided values
 *
 * If no variables:
 * - Appends user input as supplementary text to the instruction
 *
 * @param selectedEffect - The selected AI effect with name and instruction
 * @param userPrompt - The user's input text
 * @returns The final combined prompt
 */
export function computeFinalPrompt(selectedEffect: SelectedEffect | null, userPrompt: string): string {
  if (!selectedEffect) {
    return userPrompt
  }

  if (hasVariables(selectedEffect.instruction)) {
    // Parse user input and replace variables in instruction
    let processedInstruction = selectedEffect.instruction
    const lines = userPrompt.split('\n')

    for (const line of lines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const displayName = line.substring(0, colonIndex).trim()
        let varValue = line.substring(colonIndex + 1).trim()
        // Treat "..." as empty/unfilled
        if (varValue === '...') varValue = ''
        const varName = displayName.replace(/\s+/gi, '_')
        if (varValue) {
          processedInstruction = processedInstruction.replace(
            new RegExp(`\\{\\{${varName.replace(/(\(|\))/g, '\\$1')}\\}\\}`, 'gi'),
            varValue
          )
        }
      }
    }
    return processedInstruction
  }

  // No variables: instruction + supplementary text
  return `${selectedEffect.instruction}${userPrompt ? ` ${userPrompt}` : ''}`
}
