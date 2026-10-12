import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";
import { getFormatter, getTranslations } from "next-intl/server";
import { getAuth } from "@/lib/auth";
import { loadGameRecord } from "@/lib/game-record";
import { BasketballScoresheet } from "@/lib/sports/basketball/scoresheet-pdf";

export const runtime = "nodejs";

/**
 * The official PDF scoresheet of an approved game, rendered on demand from the
 * approved event log. Access follows the database rules: league staff and members.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> },
) {
  const { gameId } = await params;
  const headers = { "Cache-Control": "private, no-store" };
  if (!z.uuid().safeParse(gameId).success)
    return new Response("Not found", { status: 404, headers });
  const auth = await getAuth();
  if (!auth) return new Response("Sign in required", { status: 401, headers });
  const record = await loadGameRecord(auth.supabase, gameId);
  if (!record || record.game.status !== "approved" || !record.result)
    return new Response("Not found", { status: 404, headers });
  if (record.sport !== "basketball")
    return new Response("Not available", { status: 404, headers });
  const t = await getTranslations("Scoresheet");
  const format = await getFormatter();
  const dateTime = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const pdf = await renderToBuffer(
    <BasketballScoresheet
      record={record}
      when={record.game.scheduledAt ? dateTime(record.game.scheduledAt) : ""}
      approvedAt={dateTime(record.result.approved_at)}
      t={(key, values) => t(key, values)}
    />,
  );
  const name = `${record.teamNames.home}-vs-${record.teamNames.away}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return new Response(new Uint8Array(pdf), {
    headers: {
      ...headers,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="scoresheet-${name || "game"}.pdf"`,
    },
  });
}
