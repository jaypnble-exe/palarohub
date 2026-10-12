"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/browser";
import {
  parseGameEvents,
  scorerSetupSchema,
  type ScorerSetup,
} from "@/lib/game-events";
import type { BasketballEvent } from "@/lib/sports/basketball";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BasketballScorebook } from "./basketball/board";

type Stage =
  | { kind: "loading" }
  | { kind: "pin"; message?: string; staff: boolean }
  | { kind: "ready"; setup: ScorerSetup; events: BasketballEvent[] }
  | { kind: "error"; message: string };

/**
 * Unlocks one game's scorebook on this device and hands it to the sport's
 * scorer screen. No account is needed: the device signs in anonymously and
 * the game PIN makes it the official scorer device.
 */
export function Scorebook({ gameId }: { gameId: string }) {
  const t = useTranslations("Scorer");
  const supabase = useMemo(() => createClient(), []);
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (): Promise<Stage | null> => {
    const setup = await supabase.rpc("scorer_game_setup", {
      p_game_id: gameId,
    });
    if (setup.error) return null;
    const parsed = scorerSetupSchema.safeParse(setup.data);
    if (!parsed.success) return { kind: "error", message: "setupFailed" };
    const rows = await supabase
      .from("game_events")
      .select("id,sequence,type,payload,clock_ms,occurred_at")
      .eq("game_id", gameId)
      .order("sequence");
    if (rows.error) return { kind: "error", message: "setupFailed" };
    const { events } = parseGameEvents(parsed.data.sport, rows.data);
    return {
      kind: "ready",
      setup: parsed.data,
      events: events as BasketballEvent[],
    };
  }, [supabase, gameId]);

  const claim = useCallback(
    async (code: string | null) => {
      const { data, error } = await supabase.rpc("claim_scorer_access", {
        p_game_id: gameId,
        p_pin: code ?? undefined,
      });
      if (error) return "claimFailed";
      if (data !== "granted") return `claim.${data}`;
      return null;
    },
    [supabase, gameId],
  );

  useEffect(() => {
    let cancelled = false;
    async function start() {
      // A PIN in the QR link's #fragment never reaches the server; remove it from view.
      const fromLink = /^#pin=(\d{6})$/.exec(window.location.hash)?.[1];
      if (fromLink)
        window.history.replaceState(null, "", window.location.pathname);
      const session = await supabase.auth.getSession();
      let user = session.data.session?.user;
      if (!user) {
        const anonymous = await supabase.auth.signInAnonymously();
        if (anonymous.error || !anonymous.data.user) {
          if (!cancelled)
            setStage({ kind: "error", message: "anonymousUnavailable" });
          return;
        }
        user = anonymous.data.user;
      }
      let next = await load();
      if (!next && fromLink) {
        const problem = await claim(fromLink);
        next = problem
          ? { kind: "pin", message: problem, staff: false }
          : await load();
      }
      if (!cancelled)
        setStage(next ?? { kind: "pin", staff: !user.is_anonymous });
    }
    void start();
    return () => {
      cancelled = true;
    };
  }, [supabase, load, claim]);

  async function unlock(code: string | null) {
    setBusy(true);
    const problem = await claim(code);
    const next = problem ? null : await load();
    setBusy(false);
    if (next) setStage(next);
    else
      setStage({
        kind: "pin",
        message: problem ?? "setupFailed",
        staff: stage.kind === "pin" && stage.staff,
      });
  }

  if (stage.kind === "loading")
    return (
      <p role="status" className="p-8 text-center text-lg">
        {t("opening")}
      </p>
    );
  if (stage.kind === "error")
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <p role="alert" className="text-lg font-semibold">
          {t(stage.message)}
        </p>
        <Button type="button" onClick={() => window.location.reload()}>
          {t("tryAgain")}
        </Button>
      </div>
    );
  if (stage.kind === "pin")
    return (
      <form
        className="mx-auto max-w-sm space-y-5 p-8"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void unlock(pin);
        }}
      >
        <h1 className="font-display text-3xl font-semibold">
          {t("enterPinTitle")}
        </h1>
        <p className="text-muted-foreground">{t("enterPinHelp")}</p>
        <label htmlFor="scorer-pin" className="sr-only">
          {t("pinLabel")}
        </label>
        <Input
          id="scorer-pin"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={pin}
          onChange={(event) =>
            setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          className="text-center font-display text-4xl tracking-[0.4em]"
        />
        {stage.message && (
          <p role="alert" className="text-sm text-destructive">
            {t(stage.message)}
          </p>
        )}
        <Button className="w-full" disabled={busy || pin.length !== 6}>
          {t("unlock")}
        </Button>
        {stage.staff && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void unlock(null)}
          >
            {t("scoreHere")}
          </Button>
        )}
        <p className="text-sm text-muted-foreground">{t("takeOverNote")}</p>
      </form>
    );
  if (stage.setup.sport === "basketball")
    return (
      <BasketballScorebook
        supabase={supabase}
        setup={stage.setup}
        saved={stage.events}
      />
    );
  return null;
}
