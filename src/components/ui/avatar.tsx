import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/** Initials in a rounded square; a person icon when there is no name. */
export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl bg-accent font-display text-lg font-semibold",
        className,
      )}
    >
      {initials || <Icon name="players" className="size-5" />}
    </span>
  );
}
