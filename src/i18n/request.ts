import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { resolveLocale } from "./locales";

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get("locale")?.value);
  return {
    locale,
    timeZone: "Asia/Riyadh",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
