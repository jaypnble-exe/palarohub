"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { createScorerPin } from "@/app/(admin)/admin/[league]/schedule/actions";
import { Button } from "@/components/ui/button";
import { ScheduleFeedback, useScheduleMutation } from "./mutation";

/** Issues a game PIN and shows it with a QR code for the scorer's device. */
export function ScorerAccess({
  slug,
  gameId,
  siteUrl,
}: {
  slug: string;
  gameId: string;
  siteUrl: string;
}) {
  const t = useTranslations("Scorer");
  const mutation = useScheduleMutation();
  const [pin, setPin] = useState<string>();
  const [qr, setQr] = useState<string>();
  const link = `${siteUrl}/score/${gameId}`;
  return (
    <details className="rounded-xl border bg-background p-3">
      <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-orange-dark">
        {t("scorerAccess")}
      </summary>
      <div className="mt-3 space-y-4">
        <p className="text-sm text-muted-foreground">{t("scorerAccessHelp")}</p>
        {pin ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold">{t("pinLabel")}</p>
            <p
              className="font-display text-5xl font-semibold tracking-[0.3em]"
              aria-live="polite"
            >
              {pin}
            </p>
            {qr && (
              // A data URL generated on this device; next/image adds nothing here.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt={t("qrAlt")}
                width={192}
                height={192}
                className="rounded-xl border bg-white p-2"
              />
            )}
            <p className="text-sm text-muted-foreground">{t("pinExpires")}</p>
            <Button asChild variant="outline">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(t("shareScorerText", { link }))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("shareLink")}
              </a>
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant={pin ? "outline" : "default"}
            disabled={mutation.pending}
            onClick={() =>
              mutation.run(
                () => createScorerPin(slug, gameId),
                async (result) => {
                  if (!result.pin) return;
                  setPin(result.pin);
                  setQr(
                    await QRCode.toDataURL(`${link}#pin=${result.pin}`, {
                      margin: 1,
                      width: 384,
                    }),
                  );
                },
              )
            }
          >
            {t(pin ? "newPin" : "createPin")}
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/score/${gameId}`}>{t("scoreHere")}</Link>
          </Button>
        </div>
        {mutation.result?.error && (
          <ScheduleFeedback
            result={mutation.result}
            message={(key) => t(key)}
          />
        )}
      </div>
    </details>
  );
}
