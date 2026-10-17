import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getAuth } from "@/lib/auth";
import { displayNameOf } from "@/lib/user-name";
import { accountChoices } from "@/lib/saved-accounts";
import { AccountMenu } from "./account-menu";
import { SignInLink } from "./sign-in-link";
import { Icon } from "./ui/icon";

/** One compact row: the brand, and the account menu or a sign-in link. */
export async function SiteHeader() {
  const t = await getTranslations("Header");
  const auth = await getAuth();
  const email = auth?.user.email ?? "";
  const name = auth ? displayNameOf(auth.user) : "";
  const accounts = auth ? await accountChoices(auth.user.id) : [];
  return (
    <header className="bg-navy text-on-dark">
      <div className="mx-auto flex min-h-16 max-w-4xl items-center justify-between gap-3 px-5 py-2">
        <Link
          href={auth ? "/leagues" : "/"}
          aria-label={t("home")}
          className="flex min-h-11 items-center gap-2.5 rounded-xl"
        >
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-xl bg-primary text-white"
          >
            <Icon name="games" className="size-5" />
          </span>
          <span className="font-display text-2xl leading-none font-bold tracking-wide uppercase">
            {t("name")}
          </span>
        </Link>
        {auth ? (
          <AccountMenu name={name} email={email} accounts={accounts} />
        ) : (
          <SignInLink label={t("signIn")} />
        )}
      </div>
    </header>
  );
}
