"use server";

import { cookies } from "next/headers";
import { resolveLocale } from "./locales";

export async function setLocale(value: string) {
  (await cookies()).set("locale", resolveLocale(value), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
