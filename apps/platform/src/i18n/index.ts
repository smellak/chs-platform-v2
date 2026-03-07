import { es } from "./es";
import { en } from "./en";
import type { TranslationKeys } from "./es";

const locales: Record<string, TranslationKeys> = { es, en };
type Locale = "es" | "en";

const defaultLocale: Locale = "es";

export function t(): TranslationKeys {
  return locales[defaultLocale]!;
}

export function getLocale(): Locale {
  return defaultLocale;
}

export { es, en };
export type { Locale, TranslationKeys };
