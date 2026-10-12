import { requireUser } from "@/lib/auth";

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser("/team");
  return children;
}
