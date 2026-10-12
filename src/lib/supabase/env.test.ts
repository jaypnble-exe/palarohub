import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseConfig, hasSupabaseConfig } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("Supabase public configuration", () => {
  it("uses a cloud publishable key for every client", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "legacy-key");
    expect(hasSupabaseConfig()).toBe(true);
    expect(getSupabaseConfig()).toEqual({
      url: "https://project.supabase.co",
      key: "sb_publishable_test",
    });
  });
  it("supports an optional legacy key for local development", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:55321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-key");
    expect(getSupabaseConfig().key).toBe("local-key");
  });
  it("requires a public API key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(hasSupabaseConfig()).toBe(false);
    expect(getSupabaseConfig).toThrow(
      "Supabase environment is not configured.",
    );
  });
  it("requires a Supabase URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(hasSupabaseConfig()).toBe(false);
    expect(getSupabaseConfig).toThrow(
      "Supabase environment is not configured.",
    );
  });
});
