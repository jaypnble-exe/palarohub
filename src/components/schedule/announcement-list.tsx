import { getFormatter, getTranslations } from "next-intl/server";

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
  if (!announcements.length)
    return <p className="rounded-2xl border bg-card p-5">{t("none")}</p>;
  return (
    <ul className="space-y-3">
      {announcements.map((item) => (
        <li key={item.id} className="space-y-2 rounded-2xl border bg-card p-5">
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
