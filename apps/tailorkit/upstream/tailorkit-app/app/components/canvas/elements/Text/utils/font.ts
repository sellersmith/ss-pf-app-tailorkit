export function formatFontFamily(font: string) {
  return font ? `${font.replace(/"/g, '')}` : ''
}

export const processTextToLines = (inputText: string | string[]): string[] => {
  if (Array.isArray(inputText)) {
    return inputText
  }

  // Handle string with line breaks
  return inputText.split(/\r?\n/)
}
