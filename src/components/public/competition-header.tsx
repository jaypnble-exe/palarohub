import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page-header";
import { ChipLinks } from "@/components/ui/chip";

export async function CompetitionHeader({
  slug,
  leagueName,
  section,
  seasons,
  season,
}: {
  slug: string;
  leagueName: string;
  section: "stats" | "brackets" | "awards";
  seasons: readonly { id: string; name: string }[];
  season?: { id: string; name: string };
}) {
  const t = await getTranslations("Competition");
  return (
    <>
      <PageHeader
        back={{ href: `/${slug}`, label: leagueName }}
        eyebrow={season?.name}
        title={t(section)}
        description={t(`${section}Intro`)}
      />
      <ChipLinks
        label={t("sections")}
        links={(["stats", "brackets", "awards"] as const).map((item) => ({
          href: `/${slug}/${item}${season ? `?season=${season.id}` : ""}`,
          label: t(item),
          current: section === item,
        }))}
      />
      {seasons.length > 1 && (
        <ChipLinks
          label={t("chooseSeason")}
          links={seasons.map((item) => ({
            href: `/${slug}/${section}?season=${item.id}`,
            label: item.name,
            current: item.id === season?.id,
          }))}
        />
      )}
    </>
  );
}
