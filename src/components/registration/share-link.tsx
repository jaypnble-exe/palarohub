"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cardVariants } from "@/components/ui/card";
import { cn } from "@/lib/utils";
export function RegistrationShareLink({ url }: { url: string }) {
  const t = useTranslations("Registration");
  const [feedback, setFeedback] = useState<string>();
  return (
    <section className={cn(cardVariants(), "space-y-4")}>
      <h2 className="font-display text-2xl font-semibold">
        {t("shareRegistration")}
      </h2>
      <label htmlFor="registration-link" className="sr-only">
        {t("registrationLink")}
      </label>
      <Input
        id="registration-link"
        value={url}
        readOnly
        onFocus={(event) => event.target.select()}
      />
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setFeedback("linkCopied");
            } catch {
              setFeedback("copyFailed");
            }
          }}
        >
          {t("copyLink")}
        </Button>
        <Button asChild variant="outline">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("whatsapp")}
          </a>
        </Button>
        <Button asChild variant="outline">
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("facebook")}
          </a>
        </Button>
      </div>
      {feedback && (
        <p role="status" className="text-sm">
          {t(feedback)}
        </p>
      )}
    </section>
  );
}
