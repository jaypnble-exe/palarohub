import { getLeagueAccess } from "@/lib/league-access";
import { AdminNav } from "@/components/admin/admin-nav";

/** Every commissioner page shares the same navigation. */
export default async function LeagueAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ league: string }>;
}) {
  const { league: slug } = await params;
  const { canView } = await getLeagueAccess(slug);
  if (!canView) return children;
  return (
    <div className="pb-24 sm:pb-10">
      <AdminNav slug={slug} />
      {children}
    </div>
  );
}
