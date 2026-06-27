/**
 * Translation service using Google's Generative Language API
 * Based on the existing translation functionality in scripts/generate-translations.cjs
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export interface TranslationConfig {
  apiKey?: string
  temperature?: number
  maxOutputTokens?: number
}

export class TranslationService {
  private apiKey: string
  private temperature: number
  private maxOutputTokens: number

  constructor(config: TranslationConfig = {}) {
    this.apiKey = config.apiKey || process.env.GOOGLE_AI_API_KEY || ''
    this.temperature = config.temperature ?? 0.1
    this.maxOutputTokens = config.maxOutputTokens ?? 8192

    if (!this.apiKey) {
      throw new Error('GOOGLE_AI_API_KEY is not set in environment variables')
    }
  }

  /**
   * Translates text to English using Google's Generative Language API
   * @param text - Text to translate
   * @returns Promise<string> - Translated text in English
   */
  async translateToEnglish(text: string): Promise<string> {
    try {
      if (!text || typeof text !== 'string') {
        return text || ''
      }

      const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    `Translate the following text to English. If the text is already in English, return it unchanged. `
                    + `Return only the translated text, no explanations or additional content:\n\n"${text}"`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: this.temperature,
            maxOutputTokens: this.maxOutputTokens,
            topP: 1,
            topK: 40,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response format from API')
      }

      // Clean up the response to get just the translated text
      const rawTranslation = data.candidates[0].content.parts[0].text
      const translatedText = rawTranslation
        .trim()
        // Remove quotes if present
        .replace(/^["']|["']$/g, '')
        // Remove any "Translation:" prefix if present
        .replace(/^Translation:\s*/i, '')
        .trim()

      return translatedText || text
    } catch (error) {
      console.error(`Translation to English failed for "${text}":`, error)
      return text // Return original text if translation fails
    }
  }
}

// Default export for easy importing
export default TranslationService
