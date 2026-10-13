import Link from "next/link";
import { cn } from "@/lib/utils";
import { cardVariants } from "./card";
import { Icon, type IconName } from "./icon";

export interface Tile {
  href: string;
  icon: IconName;
  label: string;
  description?: string;
}

/** Big tap targets with an icon and a label, two per row on a phone. */
export function TileGrid({ tiles }: { tiles: readonly Tile[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((tile) => (
        <li key={tile.href}>
          <Link
            href={tile.href}
            className={cn(
              cardVariants({ interactive: true }),
              "flex h-full min-h-[96px] flex-col gap-2",
            )}
          >
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-orange-dark">
              <Icon name={tile.icon} />
            </span>
            <span className="font-semibold leading-tight">{tile.label}</span>
            {tile.description && (
              <span className="text-sm leading-snug text-muted-foreground">
                {tile.description}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
