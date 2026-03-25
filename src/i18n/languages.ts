export const SUPPORTED_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["value"];

export const DEFAULT_LANGUAGE: SupportedLanguage = "en";
