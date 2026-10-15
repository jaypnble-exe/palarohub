import { getAuth } from "@/lib/auth";
import { z } from "zod";
import {
  MAX_TEAM_IMAGE_BYTES,
  TEAM_MEDIA_BUCKET,
  teamImageFormat,
  teamMediaKindSchema,
} from "@/lib/validation/team-media";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ league: string }> },
) {
  const auth = await getAuth();
  if (!auth) return Response.json({ error: "notAllowed" }, { status: 401 });
  const { league: slug } = await params;
  const { supabase, user } = auth;
  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (leagueError || !league)
    return Response.json({ error: "notAllowed" }, { status: 403 });
  if (
    Number(request.headers.get("content-length")) >
    MAX_TEAM_IMAGE_BYTES + 64 * 1024
  )
    return Response.json({ error: "imageTooLarge" }, { status: 413 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalidImage" }, { status: 400 });
  }
  const teamId = z.uuid().safeParse(form.get("teamId"));
  const kind = teamMediaKindSchema.safeParse(form.get("kind"));
  const file = form.get("file");
  if (
    !teamId.success ||
    !kind.success ||
    !(file instanceof File) ||
    file.size === 0
  )
    return Response.json({ error: "invalidImage" }, { status: 400 });
  if (file.size > MAX_TEAM_IMAGE_BYTES)
    return Response.json({ error: "imageTooLarge" }, { status: 413 });
  const { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("league_id", league.id)
    .eq("id", teamId.data)
    .eq("manager_id", user.id)
    .maybeSingle();
  if (!team) return Response.json({ error: "notAllowed" }, { status: 403 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = teamImageFormat(bytes);
  if (!format) return Response.json({ error: "invalidImage" }, { status: 400 });
  const path = `${league.id}/${team.id}/${kind.data}/${crypto.randomUUID()}.${format.extension}`;
  const bucket = supabase.storage.from(TEAM_MEDIA_BUCKET);
  const { error } = await bucket.upload(path, bytes, {
    contentType: format.mime,
    upsert: false,
  });
  if (error) return Response.json({ error: "uploadFailed" }, { status: 400 });
  const { data: signed, error: signError } = await bucket.createSignedUrl(
    path,
    3600,
  );
  if (signError || !signed)
    return Response.json({ error: "uploadFailed" }, { status: 400 });
  return Response.json({ path, url: signed.signedUrl });
}
