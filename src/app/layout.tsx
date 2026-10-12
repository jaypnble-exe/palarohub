import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { Oswald, Public_Sans } from "next/font/google";
import "./globals.css";

const displayFont = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
  display: "swap",
});
const bodyFont = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Home");
  return { title: t("name"), description: t("tagline") };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${displayFont.variable} ${bodyFont.variable}`}
    >
      <body className="antialiased">
        <NextIntlClientProvider>
          <SiteHeader />
          <div className="mx-auto w-full max-w-4xl px-5">{children}</div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
