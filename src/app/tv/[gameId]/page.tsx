import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { TvScreen } from "@/components/tv/tv-screen";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Tv");
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

/** The gym TV scoreboard: public, read-only, full screen with no site navigation. */
export default async function TvPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  if (!z.uuid().safeParse(gameId).success) notFound();
  return (
    <main className="fixed inset-0 z-50 bg-navy">
      <TvScreen gameId={gameId} />
    </main>
  );
}
