export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
