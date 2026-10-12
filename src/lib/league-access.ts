import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser, isPlatformAdmin } from "./auth";

export const getLeagueAccess = cache(
  async (slug: string, workspace: "admin" | "team" = "admin") => {
    const { supabase, user } = await requireUser(`/${workspace}/${slug}`);
    const { data: league, error } = await supabase
      .from("leagues")
      .select("id,name,slug,sport,settings")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error("Unable to load league.");
    if (!league) notFound();
    const { data: roles, error: roleError } = await supabase
      .from("league_members")
      .select("role")
      .eq("league_id", league.id)
      .eq("user_id", user.id);
    if (roleError) throw new Error("Unable to check league access.");
    const platformAdmin = await isPlatformAdmin();
    const commissioner =
      roles?.some((item) => item.role === "commissioner") ?? false;
    const staff = roles?.some((item) => item.role === "league_staff") ?? false;
    return {
      supabase,
      user,
      league,
      canView: platformAdmin || commissioner || staff,
      canManage: platformAdmin || commissioner,
      canRegister:
        platformAdmin ||
        commissioner ||
        (roles?.some((item) => item.role === "team_manager") ?? false),
    };
  },
);
