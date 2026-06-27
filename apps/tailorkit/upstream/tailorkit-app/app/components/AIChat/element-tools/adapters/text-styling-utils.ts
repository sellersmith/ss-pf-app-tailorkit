/**
 * Shared utility to extract text styling properties from tool args.
 * Used by both TextAdapter and TextCustomerAdapter to avoid duplication.
 * Font family is passed as { family, src } — src is pre-resolved by
 * preResolveCreateElementFontCalls() before command execution.
 */

import type { TextSettings } from '~/types/psd'

/** Extract optional text styling fields from tool args into TextSettings shape */
export function buildTextStylingFromArgs(args: Record<string, any>): Partial<TextSettings> {
  const styling: Partial<TextSettings> = {}

  if (args.font_family) {
    // src is pre-resolved by preResolveTextFontCalls in command-pipeline
    styling.fontFamily = { family: args.font_family, src: args._resolved_font_src || '' }
  }
  if (args.font_size !== undefined) {
    styling.fontSize = args.font_size
  }
  if (args.text_color) {
    styling.textColor = args.text_color
  }
  if (args.text_align) {
    styling.textAlign = args.text_align
  }

  return styling
}
