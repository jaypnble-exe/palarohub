import { z } from "zod";

export const emailSchema = z.object({
  email: z.string().trim().pipe(z.email()),
});

/** Allow only same-site relative destinations; never trust a callback query URL. */
export function safeNextPath(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return "/leagues";
  const url = new URL(value, "https://palarohub.invalid");
  if (
    url.origin !== "https://palarohub.invalid" ||
    url.pathname.startsWith("/auth/") ||
    url.pathname === "/login"
  )
    return "/leagues";
  return `${url.pathname}${url.search}${url.hash}`;
}
