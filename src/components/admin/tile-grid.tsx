import Link from "next/link";
import { DashboardIcon, type IconName } from "./dashboard-icon";

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
            className="flex h-full min-h-[96px] flex-col gap-2 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-accent text-orange-dark">
              <DashboardIcon name={tile.icon} />
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
