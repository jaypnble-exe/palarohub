import "server-only";
import type { createClient } from "./supabase/server";
import {
  TEAM_MEDIA_BUCKET,
  type RegistrationMediaAssets,
} from "./validation/team-media";

export async function registrationMedia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  registration: { logo_path: string | null; jersey_design_path: string | null },
): Promise<RegistrationMediaAssets> {
  const entries = (
    [
      ["logo", registration.logo_path],
      ["jersey", registration.jersey_design_path],
    ] as const
  ).filter(
    (entry): entry is readonly ["logo" | "jersey", string] => !!entry[1],
  );
  if (!entries.length) return {};
  const { data, error } = await supabase.storage
    .from(TEAM_MEDIA_BUCKET)
    .createSignedUrls(
      entries.map(([, path]) => path),
      3600,
    );
  if (error || data?.some((item) => item.error || !item.signedUrl))
    throw new Error("Unable to load registration images.");
  return Object.fromEntries(
    entries.map(([kind, path], index) => [
      kind,
      { path, url: data![index].signedUrl },
    ]),
  );
}
