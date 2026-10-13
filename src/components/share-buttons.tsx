"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/** Copy, WhatsApp, and Facebook sharing for any public page. */
export function ShareButtons({ url, text }: { url: string; text: string }) {
  const t = useTranslations("Share");
  const [feedback, setFeedback] = useState<"linkCopied" | "copyFailed">();
  return (
    <div className="space-y-2">
      {/* WhatsApp first: it is where league members talk. */}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("whatsapp")}
          </a>
        </Button>
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
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("facebook")}
          </a>
        </Button>
      </div>
      {feedback && (
        <Alert tone={feedback === "linkCopied" ? "success" : "danger"}>
          {t(feedback)}
        </Alert>
      )}
    </div>
  );
}
