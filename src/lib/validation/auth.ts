import { z } from "zod";

const email = z.string().trim().pipe(z.email());
/** Supabase keeps at most 72 bytes of a password; 8 characters is the minimum here. */
export const passwordSchema = z.string().min(8).max(72);

export const emailSchema = z.object({ email });
export const signInSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});
export const signUpSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email,
  password: passwordSchema,
});
export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "mismatch",
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

/** "/sindikato/register/<season>" → the season id, when someone came from a registration link. */
export function registrationSeason(next: string): string | undefined {
  return /^\/[a-z0-9-]+\/register\/([0-9a-f-]{36})(?:[/?#]|$)/i.exec(next)?.[1];
}
