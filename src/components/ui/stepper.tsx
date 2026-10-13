import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/**
 * Numbered steps with short labels, e.g. Team → Players → Send. Steps
 * before `current` show a check; with `onSelect` they can be tapped to go
 * back. A `current` past the last step marks everything done. With more
 * than three steps, phones name only the current one.
 */
export function Stepper({
  label,
  steps,
  current,
  tone = "navy",
  onSelect,
}: {
  label: string;
  steps: readonly string[];
  /** Zero-based index of the step in progress. */
  current: number;
  /** "primary" draws attention, e.g. when a step needs changes. */
  tone?: "navy" | "primary";
  onSelect?: (index: number) => void;
}) {
  return (
    <ol className="flex items-center gap-2" aria-label={label}>
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        const marker = (
          <>
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                done
                  ? "bg-success text-white"
                  : active
                    ? tone === "primary"
                      ? "bg-primary text-white"
                      : "bg-navy text-on-dark"
                    : "bg-accent text-muted-foreground",
              )}
            >
              {done ? <Icon name="check" className="size-4" /> : index + 1}
            </span>
            {/* On narrow phones only the current step is named; the rest keep their number. */}
            <span
              className={cn(
                "text-sm font-semibold",
                !done && !active && "text-muted-foreground",
                !active && steps.length > 3 && "sr-only sm:not-sr-only",
              )}
            >
              {step}
            </span>
          </>
        );
        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className="flex flex-1 items-center gap-2"
          >
            {done && onSelect ? (
              <button
                type="button"
                className="flex min-h-11 items-center gap-2 rounded-lg hover:underline"
                onClick={() => onSelect(index)}
              >
                {marker}
              </button>
            ) : (
              marker
            )}
            {index < steps.length - 1 && (
              <span
                className={cn(
                  "h-0.5 flex-1 rounded",
                  done ? "bg-success" : "bg-border",
                )}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
