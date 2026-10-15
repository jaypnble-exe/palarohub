// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { TeamMediaUpload } from "./team-media";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const teamId = "81000000-0000-4000-8000-000000000001";
const asset = {
  path: `87000000-0000-4000-8000-000000000001/${teamId}/logo/88000000-0000-4000-8000-000000000001.png`,
  url: "https://example.test/logo.png",
};
function show(kind: "logo" | "jersey" = "logo", existing = false) {
  const onChange = vi.fn(),
    onBusy = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Riyadh">
      <TeamMediaUpload
        slug="sindikato"
        teamId={teamId}
        kind={kind}
        disabled={false}
        asset={existing ? asset : undefined}
        onChange={onChange}
        onBusy={onBusy}
      />
    </NextIntlClientProvider>,
  );
  return { onChange, onBusy };
}
describe("registration image upload", () => {
  it("uploads the logo for the selected team and shows the returned preview", async () => {
    const upload = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => asset });
    vi.stubGlobal("fetch", upload);
    const { onChange, onBusy } = show();
    const file = new File(["image"], "logo.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(en.Registration.teamLogoUpload), {
      target: { files: [file] },
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(asset));
    const form = upload.mock.calls[0][1].body as FormData;
    expect(form.get("teamId")).toBe(teamId);
    expect(form.get("kind")).toBe("logo");
    expect(onBusy.mock.calls).toEqual([[true], [false]]);
  });
  it("rejects unsupported and oversized files without uploading", () => {
    const upload = vi.fn();
    vi.stubGlobal("fetch", upload);
    show();
    const input = screen.getByLabelText(en.Registration.teamLogoUpload);
    fireEvent.change(input, {
      target: {
        files: [new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" })],
      },
    });
    expect(screen.getByText(en.Registration.invalidImage)).toBeInTheDocument();
    fireEvent.change(input, {
      target: {
        files: [
          new File([new Uint8Array(5 * 1024 * 1024 + 1)], "logo.png", {
            type: "image/png",
          }),
        ],
      },
    });
    expect(screen.getByText(en.Registration.imageTooLarge)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });
  it("keeps an existing logo after an upload fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { onChange } = show("logo", true);
    fireEvent.change(screen.getByLabelText(en.Registration.teamLogoUpload), {
      target: {
        files: [new File(["image"], "new.png", { type: "image/png" })],
      },
    });
    await screen.findByText(en.Registration.uploadFailed);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("img")).toHaveAttribute("src", asset.url);
  });
  it("lets the manager remove the optional jersey design", () => {
    const { onChange } = show("jersey", true);
    fireEvent.click(
      screen.getByRole("button", { name: en.Registration.removeJerseyDesign }),
    );
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
