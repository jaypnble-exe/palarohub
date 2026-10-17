"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { forgetAccount, switchAccount } from "@/app/auth/accounts";
import type { AccountChoice } from "@/lib/saved-accounts";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/**
 * Other accounts saved on this device: tap one to continue as that person
 * without a password, or remove it from the device.
 */
export function AccountChoices({
  accounts,
  compact = false,
}: {
  accounts: readonly AccountChoice[];
  /** Inside the account menu rather than on the sign-in page. */
  compact?: boolean;
}) {
  const t = useTranslations("Accounts");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string>();
  const [expired, setExpired] = useState<string>();
  if (!accounts.length && !expired) return null;
  return (
    <div className="space-y-2">
      {expired && (
        <Alert tone="warning">{t("expired", { email: expired })}</Alert>
      )}
      <ul className="space-y-1">
        {accounts.map((account) => (
          <li key={account.id} className="flex items-center gap-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setBusy(account.id);
                setExpired(undefined);
                start(async () => {
                  const result = await switchAccount(account.id);
                  // A successful switch redirects; only failures come back.
                  if (result?.error === "expired") setExpired(account.email);
                  router.refresh();
                  setBusy(undefined);
                });
              }}
              className={cn(
                "flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 text-left transition-colors hover:bg-accent disabled:opacity-60",
                !compact && "border bg-card py-2",
              )}
            >
              <Avatar name={account.name || account.email} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {busy === account.id
                    ? t("switching")
                    : compact
                      ? account.name || account.email
                      : t("continueAs", {
                          name: account.name || account.email,
                        })}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {account.email}
                </span>
              </span>
            </button>
            <button
              type="button"
              disabled={pending}
              aria-label={t("remove", { email: account.email })}
              title={t("remove", { email: account.email })}
              onClick={() =>
                start(async () => {
                  await forgetAccount(account.id);
                  router.refresh();
                })
              }
              className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Icon name="close" className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
