export const locales = ["en", "tl"] as const;
export type Locale = (typeof locales)[number];

export function resolveLocale(value: string | undefined): Locale {
  return value === "tl" ? "tl" : "en";
}
