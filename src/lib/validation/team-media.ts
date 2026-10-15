import { z } from "zod";

export const TEAM_MEDIA_BUCKET = "team-registration-media";
export const MAX_TEAM_IMAGE_BYTES = 5 * 1024 * 1024;
export const teamMediaKindSchema = z.enum(["logo", "jersey"]);
export type TeamMediaKind = z.infer<typeof teamMediaKindSchema>;
export const teamMediaPathSchema = z
  .string()
  .regex(
    /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/(logo|jersey)\/[0-9a-f-]{36}\.(png|jpg|webp)$/,
  );
export type TeamMediaAsset = { path: string; url: string };
export type RegistrationMediaAssets = Partial<
  Record<TeamMediaKind, TeamMediaAsset>
>;

/** Ignore the supplied filename and MIME type; accept supported image headers. */
export function teamImageFormat(
  bytes: Uint8Array,
): { extension: string; mime: string } | null {
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)
  )
    return { extension: "png", mime: "image/png" };
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return { extension: "jpg", mime: "image/jpeg" };
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  )
    return { extension: "webp", mime: "image/webp" };
  return null;
}
