import { getTranslations } from "next-intl/server";
import { cardVariants } from "@/components/ui/card";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const ways: { key: string; icon: IconName }[] = [
  { key: "manager", icon: "teams" },
  { key: "commissioner", icon: "workspace" },
  { key: "scorer", icon: "pin" },
  { key: "fan", icon: "public" },
];

/**
 * Nobody picks a role when they sign up: a league gives it to them. This
 * explains how each kind of person gets in.
 */
export async function AccessGuide({ className }: { className?: string }) {
  const t = await getTranslations("Access");
  return (
    <section
      aria-labelledby="access-title"
      className={cn(cardVariants(), "space-y-4", className)}
    >
      <div className="space-y-1">
        <h2 id="access-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <ul className="space-y-4">
        {ways.map((way) => (
          <li key={way.key} className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent">
              <Icon name={way.icon} className="size-5" />
            </span>
            <span className="space-y-0.5">
              <span className="block font-semibold">
                {t(`${way.key}.title`)}
              </span>
              <span className="block text-sm leading-relaxed text-muted-foreground">
                {t(`${way.key}.body`)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
