import { getFormatter, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  audience: string | null;
}

export async function AnnouncementList({
  announcements,
  actions,
}: {
  announcements: readonly AnnouncementItem[];
  actions?: (item: AnnouncementItem) => React.ReactNode;
}) {
  const t = await getTranslations("Announcements");
  const format = await getFormatter();
  if (!announcements.length) return <EmptyState title={t("none")} />;
  return (
    <ul className="space-y-3">
      {announcements.map((item) => (
        <li key={item.id} className={cn(cardVariants(), "space-y-2")}>
          <p className="text-sm text-muted-foreground">
            {format.dateTime(new Date(item.createdAt), { dateStyle: "medium" })}
            {" · "}
            {item.audience ?? t("wholeLeague")}
          </p>
          <h3 className="text-lg font-semibold break-words">{item.title}</h3>
          <p className="whitespace-pre-line break-words">{item.body}</p>
          {actions?.(item)}
        </li>
      ))}
    </ul>
  );
}
