type ExtractStrings<T> = T extends string ? T : T extends Record<string, unknown> ? ExtractStrings<T[keyof T]> : never
