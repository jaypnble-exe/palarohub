import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getAuth } from "@/lib/auth";
vi.mock("@/lib/auth", () => ({ getAuth: vi.fn() }));
const leagueId = "87000000-0000-4000-8000-000000000001",
  teamId = "81000000-0000-4000-8000-000000000001";
const upload = vi.fn(),
  createSignedUrl = vi.fn(),
  maybeTeam = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  const supabase = {
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: () =>
          table === "leagues"
            ? Promise.resolve({ data: { id: leagueId } })
            : maybeTeam(),
      };
      return q;
    },
    storage: { from: () => ({ upload, createSignedUrl }) },
  };
  vi.mocked(getAuth).mockResolvedValue({
    supabase,
    user: { id: "manager" },
  } as unknown as Awaited<ReturnType<typeof getAuth>>);
  maybeTeam.mockResolvedValue({ data: { id: teamId } });
  upload.mockResolvedValue({ error: null });
  createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://example.test/signed-image" },
    error: null,
  });
});
const context = { params: Promise.resolve({ league: "sindikato" }) };
function request(bytes: Uint8Array = new Uint8Array([255, 216, 255, 1])) {
  const form = new FormData();
  form.set("teamId", teamId);
  form.set("kind", "logo");
  form.set(
    "file",
    new File([new Uint8Array(bytes).buffer], "untrusted.png", {
      type: "image/png",
    }),
  );
  return new Request("http://localhost/api/team-media/sindikato", {
    method: "POST",
    body: form,
  });
}
describe("team image upload endpoint", () => {
  it("uploads under the authenticated team's scope using the detected image format", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.path).toMatch(
      new RegExp(`^${leagueId}/${teamId}/logo/[0-9a-f-]+\\.jpg$`),
    );
    expect(upload).toHaveBeenCalledWith(data.path, expect.any(Uint8Array), {
      contentType: "image/jpeg",
      upsert: false,
    });
  });
  it("requires an authenticated manager", async () => {
    vi.mocked(getAuth).mockResolvedValue(null);
    expect((await POST(request(), context)).status).toBe(401);
    expect(upload).not.toHaveBeenCalled();
  });
  it("rejects another manager's team", async () => {
    maybeTeam.mockResolvedValue({ data: null });
    expect((await POST(request(), context)).status).toBe(403);
    expect(upload).not.toHaveBeenCalled();
  });
  it("rejects markup even if its extension and MIME type claim PNG", async () => {
    expect(
      (await POST(request(new TextEncoder().encode("<svg/>")), context)).status,
    ).toBe(400);
    expect(upload).not.toHaveBeenCalled();
  });
  it("rejects oversized requests before reading the file", async () => {
    const req = request();
    req.headers.set("content-length", String(6 * 1024 * 1024));
    expect((await POST(req, context)).status).toBe(413);
    expect(upload).not.toHaveBeenCalled();
  });
});
