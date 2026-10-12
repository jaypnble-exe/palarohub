import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { Scorebook } from "@/components/scorer/scorebook";
import { OfflineShell } from "@/components/scorer/offline-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Scorer");
  return { title: t("pageTitle"), robots: { index: false, follow: false } };
}

/** The scorer's table: full screen, no site navigation during the game. */
export default async function ScorePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  if (!z.uuid().safeParse(gameId).success) notFound();
  return (
    <main className="fixed inset-0 z-50 overflow-auto bg-background">
      <OfflineShell>
        <Scorebook gameId={gameId} />
      </OfflineShell>
    </main>
  );
}
